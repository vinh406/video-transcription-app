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
    summarize_content,
)
from .schemas import (
    TranscriptionRequest,
    YouTubeTranscriptionRequest,
    TranscriptionResult,
    ErrorResponse,
    SummarizeRequest,
    TranscriptionListSchema,
)
from collections import defaultdict
from django_q.tasks import async_task
from .tasks import process_transcription

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
            if existing and existing.status == "completed":
                return 200, {
                    "message": "Found existing transcription",
                    "data": existing.segments,
                    "file_name": video_title,
                    "transcription_id": str(existing.id),
                    "status": existing.status,
                }
            elif existing:
                return 200, {
                    "message": "Transcription already in progress",
                    "file_name": video_title,
                    "transcription_id": str(existing.id),
                    "status": existing.status,
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
            media_file.save()

        # Create transcription record with pending status
        transcription = Transcription(
            media_file=media_file,
            service=service,
            language=language,
            status="processing",
        )
        transcription.save()

        # Enqueue the task
        async_task(
            process_transcription,
            transcription.id,
            temp_file_path,
            media_file.id,
            service,
            language,
            hook="transcription.tasks.process_complete_hook",
        )

        return 200, {
            "message": "Transcription queued successfully",
            "file_name": video_title,
            "is_youtube": True,
            "media_url": youtube_url,
            "transcription_id": str(transcription.id),
            "status": "processing",
        }
    except Exception as e:
        # Clean up temp file in case of error
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        return 500, {"message": f"Error processing YouTube video: {str(e)}"}


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
        temp_file_path = temp_audio.name

    try:
        # Calculate file hash
        hasher = hashlib.sha256()
        with open(temp_file_path, "rb") as f:
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
            if existing and existing.status == "completed":
                return 200, {
                    "message": "Found existing transcription",
                    "data": existing.segments,
                    "transcription_id": str(existing.id),
                    "status": existing.status,
                }
            elif existing:
                return 200, {
                    "message": "Transcription already in progress",
                    "transcription_id": str(existing.id),
                    "status": existing.status,
                }
        except MediaFile.DoesNotExist:
            # Upload to storage
            media_file = MediaFile(
                file=file,
                file_name=file.name,
                file_hash=file_hash,
                mime_type=file.content_type,
                user=request.user if request.user.is_authenticated else None,
            )
            media_file.save()

        # Create transcription record with pending status
        transcription = Transcription(
            media_file=media_file,
            service=service,
            language=language,
            status="processing",
        )
        transcription.save()

        # Enqueue the task
        async_task(
            process_transcription,
            transcription.id,
            temp_file_path,
            media_file.id,
            service,
            language,
        )

        return 200, {
            "message": "Transcription queued successfully",
            "transcription_id": str(transcription.id),
            "status": "processing",
        }
    except Exception as e:
        # Clean up temp file in case of error
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise e


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
            
            result = []
            summaries = Summary.objects.filter(transcription=transcription)
            for summary in summaries:
                result.append(
                    {
                        "id": str(summary.id),
                        "overview": summary.content.get("overview"),
                        "summary_points": summary.content.get("summary_points"),
                        "chapters": summary.content.get("chapters"),
                    }
                )

        except Transcription.DoesNotExist:
            # If transcription not found, just return the summary without saving
            pass

    return 200, {
        "message": "Summary generated successfully",
        "summary": result,
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
        Transcription.objects.filter(media_file__user=user, status="completed")
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
    "/tasks",
    response={200: List[TranscriptionListSchema]},
    auth=django_auth,
)
def get_running_tasks(request):
    user = request.user
    # Get transcriptions for the user's media files
    transcriptions = (
        Transcription.objects.filter(media_file__user=user)
        .exclude(status="completed")
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
                "status": transcription.status,
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

        response_data = defaultdict(list, {
            "message": "Transcription retrieved",
            "data": transcription.segments,
            "file_name": media_file.file_name,
            "transcription_id": str(transcription.id),
            "service": transcription.service,
            "language": transcription.language,
        })

        # Get summary if available
        if Summary.objects.filter(transcription=transcription).exists():
            summaries = Summary.objects.filter(transcription=transcription)
            
            for summary in summaries:
                response_data["summary"].append(
                    {
                        "id": str(summary.id),
                        "overview": summary.content.get("overview"),
                        "summary_points": summary.content.get("summary_points"),
                        "chapters": summary.content.get("chapters"),
                    }
                )

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
    request, transcription_id: str, data: TranscriptionRequest
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
            
            # Create transcription record with pending status
            transcription = Transcription(
                media_file=media_file,
                service=service,
                language=language,
                status="processing",
            )
            transcription.save()

            # Enqueue the task
            async_task(
                process_transcription,
                transcription.id,
                temp_file_path,
                media_file.id,
                service,
                language,
            )

            return 200, {
                "message": "Transcription queued successfully",
                "transcription_id": str(transcription.id),
                "status": "processing",
            }
        except Exception as e:
            # Clean up temp file in case of error
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise e

    except Transcription.DoesNotExist:
        return 404, {"message": "Transcription not found"}

@api.delete(
    "/{transcription_id}/summary/{summary_id}",
    response={200: dict, 404: ErrorResponse, 403: ErrorResponse},
    auth=django_auth,
)
def delete_summary(request, transcription_id: str, summary_id: str):
    """
    Delete a specific summary by ID.
    """
    try:
        transcription = Transcription.objects.get(id=transcription_id)

        # Check if the user has permission to delete this summary
        if transcription.media_file.user != request.user:
            return 403, {"detail": "You don't have permission to delete this summary"}

        # Find and delete the summary
        summary = Summary.objects.get(id=summary_id, transcription=transcription)
        summary.delete()

        return 200, {"detail": "Summary deleted successfully"}

    except Transcription.DoesNotExist:
        return 404, {"detail": "Transcription not found"}
    except Summary.DoesNotExist:
        return 404, {"detail": "Summary not found"}


@api.get(
    "/{transcription_id}/status",
    response={200: dict, 404: ErrorResponse},
)
def get_transcription_status(request, transcription_id: str):
    """
    Get the current status of a transcription job
    """
    try:
        transcription = Transcription.objects.get(id=transcription_id)

        response = {
            "status": transcription.status,
            "message": f"Transcription is {transcription.status}",
        }

        if transcription.status == "completed":
            response["data"] = transcription.segments
        elif transcription.status == "failed":
            response["error"] = transcription.error_message

        return 200, response

    except Transcription.DoesNotExist:
        return 404, {"message": "Transcription not found"}