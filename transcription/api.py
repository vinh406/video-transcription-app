from ninja import Form, Router, File, Schema
from ninja.files import UploadedFile
from .models import MediaFile, Transcription
import hashlib
import tempfile
import os
from typing import List, Dict, Any, Optional
from ninja.security import django_auth

# Import your existing transcription functionality
from .services.transcription import (
    transcribe_google_api,
    transcribe_elevenlabs_api,
    transcribe_whisperx,
    summarize_content,
)

api = Router()

class YouTubeTranscriptionRequest(Schema):
    youtube_url: str
    service: str
    language: str = "auto"

class TranscriptionRequest(Schema):
    service: str
    language: str = "auto"


class TranscriptionResult(Schema):
    message: str
    data: dict = None
    media_url: str = None
    file_name: str = None
    is_youtube: bool = False

class SummarizeRequest(Schema):
    """Schema for summarize request body"""

    segments: List[Dict[str, Any]]

class MediaFileSchema(Schema):
    id: str
    file_name: str
    mime_type: str
    created_at: str
    has_transcript: bool
    has_summary: bool
    service: Optional[str] = None

class ErrorResponse(Schema):
    message: str

@api.post(
    "/transcribe-youtube",
    response={200: TranscriptionResult, 400: ErrorResponse, 500: ErrorResponse},
)
def transcribe_youtube(request, data: YouTubeTranscriptionRequest):
    service = data.service
    language = data.language
    youtube_url = data.youtube_url

    try:
        # Import the YouTube service
        from .services.youtube import download_youtube_audio

        # Download the YouTube audio
        temp_audio_path, video_title, mime_type, video_id = download_youtube_audio(youtube_url)

        try:
            # Calculate a unique identifier for this YouTube video
            video_id = video_id.split("v=")[-1].split("&")[0]

            # Check if we've already processed this YouTube video
            media_file = None
            try:
                # Try to find by URL stored in file_hash field
                media_file = MediaFile.objects.get(file_hash=video_id)

                # Check if we've transcribed with this service and language
                existing = Transcription.objects.filter(
                    media_file=media_file, service=service, language=language
                ).first()
                if existing:
                    return 200, {
                        "message": "Found existing transcription",
                        "data": existing.segments,
                    }
            except MediaFile.DoesNotExist:
                # Create a new MediaFile for this YouTube video
                media_file = MediaFile(
                    file_name=video_title,
                    file_hash=video_id,
                    mime_type=mime_type,
                    user=request.user if request.user.is_authenticated else None,
                )
                media_file.save()

            # Perform transcription based on service
            result = None

            if service == "google":
                result = transcribe_google_api(temp_audio_path, language=language)
            elif service == "elevenlabs":
                result = transcribe_elevenlabs_api(temp_audio_path, language=language)
            else:  # whisperx
                result = transcribe_whisperx(temp_audio_path, language=language)

            # Save the transcription result
            transcription = Transcription(
                media_file=media_file,
                service=service,
                language=language,
                segments=result,
            )
            transcription.save()

            return 200, {"message": "Transcription successful", "data": result}

        finally:
            # Clean up temp file
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)

    except ValueError as e:
        return 400, {"message": f"Bad request: {str(e)}"}
    except Exception as e:
        return 500, {"message": f"Server error: {str(e)}"}

@api.post(
    "/transcribe",
    response={200: TranscriptionResult, 400: ErrorResponse, 500: ErrorResponse},
)
def transcribe_audio(
    request, file: UploadedFile = File(...), params: Form[TranscriptionRequest] = None
):
    service = params.service if params else "whisperx"
    language = params.language if params else "auto"

    # Create temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        for chunk in file.chunks():
            temp_audio.write(chunk)

    try:
        # Calculate file hash
        hasher = hashlib.sha256()
        with open(temp_audio.name, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        file_hash = hasher.hexdigest()

        # Check if we've already processed this file
        media_file = None
        try:
            media_file = MediaFile.objects.get(file_hash=file_hash)
            # Check if we've transcribed with this service and language
            existing = Transcription.objects.filter(
                media_file=media_file, service=service, language=language
            ).first()
            if existing:
                return 200, {
                    "message": "Found existing transcription",
                    "data": existing.segments,
                }
        except MediaFile.DoesNotExist:
            # Upload to S3
            media_file = MediaFile(
                file=file,
                file_name=file.name,
                file_hash=file_hash,
                mime_type=file.content_type,
                user=request.user if request.user.is_authenticated else None,
            )
            media_file.save()

        # Perform transcription based on service
        result = None

        if service == "google":
            result = transcribe_google_api(temp_audio.name, language=language)
        elif service == "elevenlabs":
            result = transcribe_elevenlabs_api(temp_audio.name, language=language)
        else:  # whisperx
            result = transcribe_whisperx(temp_audio.name, language=language)

        # Save the transcription result
        transcription = Transcription(
            media_file=media_file,
            service=service,
            language=language,
            segments=result,
        )
        transcription.save()

        return 200, {"message": "Transcription successful", "data": result}

    except ValueError as e:
        return 400, {"message": f"Bad request: {str(e)}"}
    finally:
        # Clean up temp file
        if os.path.exists(temp_audio.name):
            os.remove(temp_audio.name)


@api.post(
    "/summarize",
    response={200: TranscriptionResult, 400: ErrorResponse, 500: ErrorResponse},
)
def summarize_transcript(request, data: SummarizeRequest):
    """
    Generate a summary from transcript segments.
    """
    try:
        summary_result = summarize_content(data.segments)
        return 200, {
            "message": "Summary generated successfully",
            "data": summary_result,
        }
    except ValueError as e:
        return 400, {"message": f"Bad request: {str(e)}"}

@api.get("/media/history", response={200: List[MediaFileSchema]}, auth=django_auth)
def get_user_media_history(request):
    user = request.user
    media_files = MediaFile.objects.filter(user=user).order_by("-created_at")

    result = []
    for media_file in media_files:
        # Check if transcription exists
        transcription = Transcription.objects.filter(media_file=media_file).first()
        has_transcript = transcription is not None

        # Check if summary exists (a summary would be in the segments field as a summary_data key)
        has_summary = False
        if transcription and transcription.segments:
            if (
                isinstance(transcription.segments, dict)
                and "summary_data" in transcription.segments
            ):
                has_summary = True

        result.append(
            {
                "id": str(media_file.id),
                "file_name": media_file.file_name,
                "mime_type": media_file.mime_type,
                "created_at": media_file.created_at.isoformat(),
                "has_transcript": has_transcript,
                "has_summary": has_summary,
                "service": transcription.service if transcription else None,
            }
        )

    return result

@api.get(
    "/media/{media_id}",
    response={200: TranscriptionResult, 404: ErrorResponse},
    auth=django_auth,
)
def get_media_details(request, media_id: str):
    try:
        # Verify the user owns this media file
        media_file = MediaFile.objects.get(id=media_id, user=request.user)

        # Get the latest transcription
        transcription = (
            Transcription.objects.filter(media_file=media_file)
            .order_by("-created_at")
            .first()
        )

        if not transcription:
            return 404, {"message": "No transcription found for this media"}
        
        response_data = {
            "message": "Transcription retrieved",
            "data": transcription.segments,
            "file_name": media_file.file_name,
        }
        
        is_youtube = len(media_file.file_hash) == 11

        if is_youtube:
            response_data["is_youtube"] = True
            response_data["media_url"] = media_file.file_hash
        else:
            response_data["media_url"] = media_file.file.url

        return 200, response_data

    except MediaFile.DoesNotExist:
        return 404, {"message": "Media file not found"}