from ninja import Form, Router, File
from ninja.files import UploadedFile
from .models import MediaFile, Summary, Transcription
import hashlib
import tempfile
import os
from typing import List
from ninja.security import django_auth
from .services import (
    download_youtube,
    get_youtube_video_id,
    transcribe_google_api,
    transcribe_whisperx,
    transcribe_elevenlabs_api,
    summarize_content,
)
from .schemas import (
    TranscriptionRequest,
    YouTubeTranscriptionRequest,
    TranscriptionResult,
    ErrorResponse,
    SummarizeRequest,
    TranscriptionListSchema,
    RegenerateTranscriptionRequest,
)

api = Router()


@api.post(
    "/transcribe-youtube",
    response={200: TranscriptionResult, 400: ErrorResponse, 500: ErrorResponse},
)
def transcribe_youtube(request, data: YouTubeTranscriptionRequest):
    service = data.service
    language = data.language
    youtube_url = data.youtube_url

    temp_file_path = None

    # Get the video ID from the URL
    try:
        video_id, video_title = get_youtube_video_id(youtube_url)
        video_id = video_id.split("v=")[-1].split("&")[0]
        temp_file_path, mime_type = download_youtube(youtube_url)
    except Exception as e:
        return 400, {"message": f"Invalid YouTube URL: {str(e)}"}
    try:
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
                    "file_name": video_title,
                }
        except MediaFile.DoesNotExist:
            # Create a new MediaFile for this YouTube video
            media_file = MediaFile(
                file_name=video_title,
                file_hash=video_id,
                mime_type=mime_type,
                user=request.user if request.user.is_authenticated else None,
            )

            media_file.file.save(
                f"youtube_{video_id}.{mime_type.split('/')[-1]}",
                open(temp_file_path, "rb"),
                save=False,
            )

        # Perform transcription based on service
        result = None

        if service == "google":
            result = transcribe_google_api(temp_file_path, language=language)
        elif service == "elevenlabs":
            result = transcribe_elevenlabs_api(temp_file_path, language=language)
        else:  # whisperx
            result = transcribe_whisperx(temp_file_path, language=language)

        media_file.save()

        # Save the transcription result
        transcription = Transcription(
            media_file=media_file,
            service=service,
            language=language,
            segments=result,
        )
        transcription.save()

        return 200, {
            "message": "Transcription successful",
            "data": result,
            "file_name": video_title,
            "is_youtube": True,
            "media_url": youtube_url,
            "transcription_id": str(transcription.id),
        }

    finally:
        # Clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


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

        return 200, {
            "message": "Transcription successful",
            "data": result,
            "transcription_id": str(transcription.id),
        }
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
    transcription_id = data.transcription_id
    if transcription_id:
        try:
            transcription = Transcription.objects.get(id=transcription_id)

            # Generate summary using existing functionality
            summary_result = summarize_content(data.segments)

            # Create a new Summary record
            summary = Summary(
                transcription=transcription,
                content=summary_result,
            )

            summary.save()

        except Transcription.DoesNotExist:
            # If transcription not found, just return the summary without saving
            pass

    return 200, {
        "message": "Summary generated successfully",
        "summary": summary_result,
        "transcription_id": transcription_id,
    }


@api.get(
    "/history",
    response={200: List[TranscriptionListSchema]},
    auth=django_auth,
)
def get_user_transcription_history(request):
    user = request.user
    # Get transcriptions for the user's media files
    transcriptions = (
        Transcription.objects.filter(media_file__user=user)
        .select_related("media_file")
        .order_by("-created_at")
    )

    result = []
    for transcription in transcriptions:
        media_file = transcription.media_file
        has_summary = Summary.objects.filter(transcription=transcription).exists()

        # Determine if it's a YouTube file
        is_youtube = len(media_file.file_hash) == 11

        result.append(
            {
                "id": str(transcription.id),
                "media_id": str(media_file.id),
                "file_name": media_file.file_name,
                "mime_type": "youtube" if is_youtube else media_file.mime_type,
                "created_at": transcription.created_at.isoformat(),
                "service": transcription.service,
                "language": transcription.language,
                "has_summary": has_summary,
            }
        )

    return result


@api.get(
    "/{transcription_id}",
    response={200: TranscriptionResult, 404: ErrorResponse},
    auth=django_auth,
)
def get_transcription_details(request, transcription_id: str):
    try:
        # Get the transcription and verify the user owns it
        transcription = Transcription.objects.select_related("media_file").get(
            id=transcription_id, media_file__user=request.user
        )

        media_file = transcription.media_file

        response_data = {
            "message": "Transcription retrieved",
            "data": transcription.segments,
            "file_name": media_file.file_name,
            "transcription_id": str(transcription.id),
            "service": transcription.service,
            "language": transcription.language,
        }

        # Get summary if available
        if Summary.objects.filter(transcription=transcription).exists():
            summary = Summary.objects.filter(transcription=transcription).latest(
                "created_at"
            )
            response_data["summary"] = summary.content

        # Check if it's a YouTube video
        is_youtube = len(media_file.file_hash) == 11

        if is_youtube:
            response_data["is_youtube"] = True
            response_data["media_url"] = media_file.file_hash
        else:
            response_data["media_url"] = media_file.file.url

        return 200, response_data

    except Transcription.DoesNotExist:
        return 404, {"message": "Transcription not found"}

@api.delete(
    "/{transcription_id}",
    response={200: dict, 404: ErrorResponse, 403: ErrorResponse},
    auth=django_auth,
)
def delete_transcription(request, transcription_id: str):
    """
    Delete a transcription by ID.
    Only the owner of the transcription can delete it.
    """
    try:
        # Get the transcription and verify the user owns it
        transcription = Transcription.objects.select_related("media_file").get(
            id=transcription_id
        )

        # Check if the user owns this transcription
        if transcription.media_file.user != request.user:
            return 403, {
                "message": "You don't have permission to delete this transcription"
            }

        # Get the media file to check if it should be deleted too
        media_file = transcription.media_file

        # Delete any summaries associated with this transcription
        Summary.objects.filter(transcription=transcription).delete()

        # Delete the transcription
        transcription.delete()

        # Check if the media file has any other transcriptions
        has_other_transcriptions = Transcription.objects.filter(
            media_file=media_file
        ).exists()

        # If no other transcriptions use this media file, delete it too
        if not has_other_transcriptions:
            media_file.delete()

        return 200, {"message": "Transcription deleted successfully"}

    except Transcription.DoesNotExist:
        return 404, {"message": "Transcription not found"}


@api.post(
    "/{transcription_id}/regenerate",
    response={
        200: TranscriptionResult,
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
    },
    auth=django_auth,
)
def regenerate_transcription(
    request, transcription_id: str, data: RegenerateTranscriptionRequest
):
    """
    Regenerate a transcription with a different service or language.
    Only the owner of the transcription can regenerate it.
    """
    try:
        # Get the existing transcription and verify the user owns it
        transcription = Transcription.objects.select_related("media_file").get(
            id=transcription_id, media_file__user=request.user
        )

        # Get the associated media file
        media_file = transcription.media_file
        service = data.service
        language = data.language

        # Create a temp file for processing
        is_youtube = len(media_file.file_hash) == 11
        temp_file_path = None

        try:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".wav"
            ) as temp_audio:
                temp_file_path = temp_audio.name
                # Get file from storage and write to temp
                with media_file.file.open("rb") as source_file:
                    for chunk in source_file.chunks():
                        temp_audio.write(chunk)

            # Perform transcription based on service
            result = None
            if service == "google":
                result = transcribe_google_api(temp_file_path, language=language)
            elif service == "elevenlabs":
                result = transcribe_elevenlabs_api(temp_file_path, language=language)
            else:  # whisperx
                result = transcribe_whisperx(temp_file_path, language=language)

            # Create a new transcription entry
            new_transcription = Transcription(
                media_file=media_file,
                service=service,
                language=language,
                segments=result,
            )
            new_transcription.save()

            return 200, {
                "message": "Transcription regenerated successfully",
                "data": result,
                "file_name": media_file.file_name,
                "transcription_id": str(new_transcription.id),
                "service": service,
                "language": language,
                "is_youtube": is_youtube,
                "media_url": media_file.file_hash
                if is_youtube
                else media_file.file.url,
            }

        finally:
            # Clean up temp file
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except Transcription.DoesNotExist:
        return 404, {"message": "Transcription not found"}
