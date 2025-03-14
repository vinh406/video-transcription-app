from io import BytesIO
import os


eleven_client = None
# Initialize ElevenLabs client
try:
    from elevenlabs.client import ElevenLabs

    if os.getenv("ELEVENLABS_API_KEY"):
        eleven_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        print("ElevenLabs client initialized successfully")
    else:
        print("Warning: ELEVENLABS_API_KEY not found in environment variables")
except ImportError:
    print("Warning: elevenlabs package not installed")

def transcribe_elevenlabs_api(file_path, language=None):
    """Transcribe audio using ElevenLabs API"""
    if eleven_client is None:
        raise ValueError(
            "ElevenLabs client not initialized. Please set ELEVENLABS_API_KEY in .env file."
        )

    # Read the file into a BytesIO object
    with open(file_path, "rb") as f:
        audio_data = BytesIO(f.read())

    # Convert ISO 639-1 (2-letter) codes to ISO 639-2 (3-letter) codes
    lang_map = {
        "en": "eng",
        "fr": "fra",
        "de": "deu",
        "es": "spa",
        "it": "ita",
        "vi": "vie",
        # Add more mappings as needed
    }

    # Handle language code properly
    if not language or language == "auto":
        lang_code = None  # Use None for auto-detection
    else:
        # Convert 2-letter to 3-letter code if possible
        lang_code = lang_map.get(language, language)

    try:
        # Call ElevenLabs API
        print(
            f"Transcribing with ElevenLabs using language: {lang_code or 'auto-detect'}"
        )
        transcription = eleven_client.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",  # Currently only supported model
            tag_audio_events=True,
            diarize=True,  # Enable speaker diarization
        )

        # Process the words array to build segments
        segments = []

        # Check if words array exists
        if hasattr(transcription, "words") and transcription.words:
            current_segment = None
            current_text = ""
            current_speaker = None
            current_words = []

            # Group words by speaker into segments
            for word in transcription.words:
                # Skip spacing elements
                if getattr(word, "type", "") == "spacing":
                    if current_segment:
                        current_text += word.text
                    continue

                speaker_id = getattr(word, "speaker_id", "UNKNOWN")

                # Create word object
                word_obj = {
                    "start": word.start,
                    "end": word.end,
                    "word": word.text,
                    "speaker": speaker_id,
                    "score": getattr(
                        word, "confidence", 0.5
                    ),  # Default confidence if not available
                }

                # If this is a new speaker or first word, start a new segment
                if speaker_id != current_speaker or current_segment is None:
                    # Save the current segment if it exists
                    if current_segment is not None:
                        current_segment["text"] = current_text.strip()
                        current_segment["words"] = current_words
                        segments.append(current_segment)

                    # Create a new segment
                    current_segment = {
                        "start": word.start,
                        "end": word.end,
                        "text": "",
                        "speaker": speaker_id,
                    }
                    current_text = word.text
                    current_speaker = speaker_id
                    current_words = [word_obj]
                else:
                    # Continue with current segment
                    current_text += word.text
                    current_segment["end"] = word.end
                    current_words.append(word_obj)

            # Don't forget to add the last segment
            if current_segment is not None:
                current_segment["text"] = current_text.strip()
                current_segment["words"] = current_words
                segments.append(current_segment)

        # Create result in the expected format
        detected_lang = getattr(transcription, "language_code", "en")

        result = {"segments": segments, "language": detected_lang}

        return result

    except Exception as e:
        print(f"ElevenLabs transcription error: {e}")
        raise ValueError(f"ElevenLabs transcription error: {str(e)}")
