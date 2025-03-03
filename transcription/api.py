from ninja import Form, NinjaAPI, File, Schema
from ninja.files import UploadedFile
from .models import MediaFile, Transcription
import hashlib
import tempfile
import os
from typing import List, Dict, Any

# Import your existing transcription functionality
from .services.transcription import (
    transcribe_google_api,
    transcribe_elevenlabs_api,
    transcribe_whisperx,
    summarize_content,
)

api = NinjaAPI()


class TranscriptionRequest(Schema):
    service: str
    language: str = "auto"


class TranscriptionResult(Schema):
    message: str
    data: dict = None

class SummarizeRequest(Schema):
    """Schema for summarize request body"""

    segments: List[Dict[str, Any]]


class ErrorResponse(Schema):
    message: str


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
