# file: transcription/services/transcription.py

import json
import os
import time
import hashlib
import tempfile
from io import BytesIO
from pathlib import Path

import torch
import whisperx
from dotenv import load_dotenv
from google import genai
import google.genai.types as types

# Load environment variables
load_dotenv()

# Set device for WhisperX
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
HF_TOKEN = os.getenv("HF_TOKEN", "HF_TOKEN")

# Initialize clients
google_client = None
eleven_client = None
whisperx_model = None
diarize_model = None

# Initialize Google client
if os.getenv("GOOGLE_API_KEY"):
    google_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    print("Google client initialized successfully")
else:
    print("Warning: GOOGLE_API_KEY not found in environment variables")

model_name = "models/gemini-2.0-pro-exp-02-05"

# Initialize ElevenLabs client
try:
    from elevenlabs.client import ElevenLabs

    if os.getenv("ELEVENLABS_API_KEY"):
        eleven_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        print(os.getenv("ELEVENLABS_API_KEY"))
        print("ElevenLabs client initialized successfully")
    else:
        print("Warning: ELEVENLABS_API_KEY not found in environment variables")
except ImportError:
    print("Warning: elevenlabs package not installed")


def get_file_hash(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


# WhisperX model loading functions
def load_whisperx_model():
    global whisperx_model
    if whisperx_model is None:
        print("Loading WhisperX model...")
        whisperx_model = whisperx.load_model("turbo", DEVICE)
    return whisperx_model


def load_diarize_model():
    global diarize_model
    if diarize_model is None:
        print("Loading diarization model...")
        diarize_model = whisperx.DiarizationPipeline(
            use_auth_token=HF_TOKEN, device=DEVICE
        )
    return diarize_model


# File upload function for Google API
def upload_video(video_file_name):
    video_file = google_client.files.upload(file=video_file_name)

    while video_file.state == "PROCESSING":
        print("Waiting for video to be processed.")
        time.sleep(10)
        video_file = google_client.files.get(name=video_file.name)

    if video_file.state == "FAILED":
        raise ValueError(video_file.state)
    print(f"Video processing complete: {video_file.uri}")

    return video_file


# Transcription functions
def transcribe_google_api(file_path, language=None):
    """Transcribe audio using Google Gemini API"""
    if google_client is None:
        raise ValueError(
            "Google client not initialized. Please set GOOGLE_API_KEY in .env file."
        )
    
    audio = whisperx.load_audio(file_path)

    # Upload the file
    video = upload_video(file_path)
    system_instructions = """
    You are a transcription assistant. Your task is to transcribe the audio file provided to you.
    Your response must be a JSON object containing these fields: 'segments' and 'language'.
    The 'segments' field must be a list of objects with 'start', 'end', and 'text' fields.
    The 'start' and 'end' must follow the format of MM:SS.mmm.
    Timestamps should have milli-second level accuracy.
    The 'language' field must be a 2-letter language code.
    """
    prompt = (
        "Transcribe the following audio file with correct timestamps and language code."
    )

    # Generate content
    response = google_client.models.generate_content(
        model=model_name,
        contents=[prompt, video],
        config=types.GenerateContentConfig(
            system_instruction=system_instructions,
        ),
    )

    text = response.text.strip()

    # Check if text is wrapped in markdown code fences and remove them if so.
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove the first and last lines if they are markdown fences.
        if lines[0].startswith("```") and lines[-1].startswith("```"):
            text = "\n".join(lines[1:-1]).strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Error decoding JSON from GenAI API: {response.text}") from e

    # Use detected language
    detected_lang = result["language"]

    # Align timestamps
    model_a, metadata = whisperx.load_align_model(
        language_code=detected_lang, device=DEVICE
    )

    result_aligned = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        DEVICE,
        return_char_alignments=False,
    )

    # Diarization (identify speakers)
    diarize = load_diarize_model()
    diarize_segments = diarize(audio)
    result_with_speakers = whisperx.assign_word_speakers(
        diarize_segments, result_aligned
    )

    # Clean up resources
    import gc

    gc.collect()
    torch.cuda.empty_cache()

    return result_with_speakers


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


def transcribe_whisperx(file_path, language=None):
    """Transcribe audio using WhisperX with speaker diarization"""
    try:
        # Load audio
        audio = whisperx.load_audio(file_path)

        # Set language parameter
        lang_param = None if language == "auto" else language

        # Load model and transcribe
        model = load_whisperx_model()
        result = model.transcribe(audio, batch_size=4, language=lang_param)

        # Use detected language
        detected_lang = result["language"]

        # Align timestamps
        model_a, metadata = whisperx.load_align_model(
            language_code=detected_lang, device=DEVICE
        )

        result_aligned = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            DEVICE,
            return_char_alignments=False,
        )

        # Diarization (identify speakers)
        diarize = load_diarize_model()
        diarize_segments = diarize(audio)
        result_with_speakers = whisperx.assign_word_speakers(
            diarize_segments, result_aligned
        )

        # Clean up resources
        import gc

        gc.collect()
        torch.cuda.empty_cache()

        return result_with_speakers

    except Exception as e:
        print(f"WhisperX transcription error: {e}")
        raise ValueError(f"WhisperX transcription error: {str(e)}")


def summarize_content(transcript_segments):
    """Generate a summary of the transcribed content using Gemini API with timestamp references"""
    if google_client is None:
        raise ValueError(
            "Google client not initialized. Please set GOOGLE_API_KEY in .env file."
        )

    # Prepare the transcript text from segments with timestamps
    formatted_transcript = ""
    for segment in transcript_segments:
        formatted_transcript += (
            f"[{segment.get('start', 0):.2f}s] {segment.get('text', '')}\n"
        )

    summarization_prompt = f"""
    Please provide a summary of the following transcript:
    
    {formatted_transcript}
    
    For each key point in your summary, include a reference to the timestamp (in seconds) 
    where this information appears in the transcript. Format each point as:
    
    - Point summary text [timestamp]
    """

    system_instruction = """
    You are an AI assistant specialized in summarizing transcribed content.
    Provide a summary that captures the main points of the transcript in JSON format.
    Return a list of summary points, where each point includes:
    1. "text" - The summary point text without timestamp
    2. "timestamp" - The timestamp in seconds where this information appears
    
    Format your response as valid JSON with the following structure:
    {
      "summary_points": [
        {"text": "First main point", "timestamp": 45.2},
        {"text": "Second main point", "timestamp": 120.5},
        ...
      ],
      "overview": "A brief 1-2 sentence overview of the entire content"
    }

    Ensure timestamps are provided as numbers, not strings.
    """

    try:
        response = google_client.models.generate_content(
            model=model_name,
            contents=summarization_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )

        text_response = response.text.strip()

        # Extract JSON from the response (handling potential markdown code blocks)
        if "```json" in text_response:
            json_text = text_response.split("```json")[1].split("```")[0].strip()
        elif "```" in text_response:
            json_text = text_response.split("```")[1].strip()
        else:
            json_text = text_response

        try:
            # Parse the JSON response
            summary_data = json.loads(json_text)
            return {"summary_data": summary_data, "success": True}
        except json.JSONDecodeError as e:
            # If JSON parsing fails, return the raw text as before
            print(f"JSON parsing failed: {e}. Falling back to text format.")
            return {"summary": text_response, "success": True, "structured": False}

    except Exception as e:
        print(f"Error generating summary: {e}")
        return {
            "summary": "Failed to generate summary.",
            "success": False,
            "error": str(e),
        }
