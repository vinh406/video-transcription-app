import os
import torch
import whisperx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set device for WhisperX
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
HF_TOKEN = os.getenv("HF_TOKEN")
if HF_TOKEN is None:
    raise ValueError("Hugging Face token not found. Please set HF_TOKEN in .env file.")

# Initialize clients
whisperx_model = None
diarize_model = None

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

        # # Use detected language
        # detected_lang = result["language"]

        # # Align timestamps
        # model_a, metadata = whisperx.load_align_model(
        #     language_code=detected_lang, device=DEVICE
        # )

        # result = whisperx.align(
        #     result["segments"],
        #     model_a,
        #     metadata,
        #     audio,
        #     DEVICE,
        #     return_char_alignments=False,
        # )

        # Diarization (identify speakers)
        diarize = load_diarize_model()
        diarize_segments = diarize(audio)
        result_with_speakers = whisperx.assign_word_speakers(diarize_segments, result)

        # Clean up resources
        import gc

        gc.collect()
        torch.cuda.empty_cache()

        return result_with_speakers

    except Exception as e:
        print(f"WhisperX transcription error: {e}")
        raise ValueError(f"WhisperX transcription error: {str(e)}")
