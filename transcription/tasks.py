import os
import tempfile
from .models import MediaFile, Transcription
from .services import (
    transcribe_google_api,
    transcribe_elevenlabs_api,
    transcribe_whisperx,
)


def process_transcription(
    transcription_id,
    temp_file_path=None,
    media_file_id=None,
    service=None,
    language=None,
):
    """
    Process a transcription in the queue
    """
    try:
        transcription = Transcription.objects.get(id=transcription_id)
        media_file = MediaFile.objects.get(id=media_file_id)

        # Create a temporary file if we're working with a stored file
        if not temp_file_path:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
                temp_file_path = temp_audio.name
                with media_file.file.open("rb") as source_file:
                    for chunk in source_file.chunks():
                        temp_audio.write(chunk)

        # Mark transcription as in progress
        transcription.status = "processing"
        transcription.save()
        
        # Perform transcription based on service
        try:
            result = None
            if service == "google":
                result = transcribe_google_api(temp_file_path, language=language)
            elif service == "elevenlabs":
                result = transcribe_elevenlabs_api(temp_file_path, language=language)
            else:  # whisperx
                result = transcribe_whisperx(temp_file_path, language=language)

            # Update the transcription with results
            transcription.segments = result
            transcription.status = "completed"
            transcription.save()

        except Exception as e:
            transcription.status = "failed"
            transcription.error_message = str(e)
            transcription.save()
            raise

    finally:
        # Clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
