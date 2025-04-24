import time
from typing import Dict, Optional

from transcription.services import (
    transcribe_elevenlabs_api,
    transcribe_google_api,
    transcribe_whisperx,
)


class TranscriptionService:
    """Handles transcription using different services"""

    def __init__(self, service_name: str):
        """
        Initialize a transcription service

        Args:
            service_name: Name of the service ("elevenlabs", "google", "whisperx")
        """
        self.service_name = service_name.lower()

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
    ) -> Dict:
        """
        Transcribe audio using the selected service

        Args:
            audio_path: Path to audio file
            language: Language code

        Returns:
            Transcription response
        """
        start_time = time.time()

        try:
            if self.service_name == "elevenlabs":
                response = transcribe_elevenlabs_api(audio_path)
            elif self.service_name == "google":
                response = transcribe_google_api(audio_path)
            elif self.service_name == "whisperx":
                response = transcribe_whisperx(audio_path)
            else:
                raise ValueError(f"Unknown service: {self.service_name}")

            # Calculate processing time
            processing_time = time.time() - start_time

            # Add processing time to response
            if isinstance(response, dict):
                response["processing_time"] = processing_time

            return response

        except Exception as e:
            print(f"Transcription error with {self.service_name}: {str(e)}")
            raise