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


def transcribe_elevenlabs_api(
    file_path,
    language=None,
    max_segment_length: int = 200,  # Define a threshold for segment length
):
    """
    Transcribe audio using ElevenLabs API with sentence-based segmentation.

    Args:
        file_path: Path to the local audio file.
        language: Language code (ISO 639-1 or 639-2).
        max_segment_length: Preferred maximum character length for a segment's text.

    Returns:
        Dictionary containing transcription segments and detected language.
    """
    if eleven_client is None:
        raise ValueError(
            "ElevenLabs client not initialized. Please set ELEVENLABS_API_KEY in .env file."
        )

    # Read the file into a BytesIO object
    with open(file_path, "rb") as f:
        audio_data = BytesIO(f.read())

    # Convert ISO 639-1 (2-letter) codes to ISO 639-2 (3-letter) codes if needed by API
    # Note: The elevenlabs client might handle this automatically, but explicit mapping is safer.
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
        # Convert 2-letter to 3-letter code if possible, otherwise use provided code
        lang_code = lang_map.get(
            language.lower(), language
        )  # Use lower() for case-insensitivity

    try:
        # Call ElevenLabs API
        print(
            f"Transcribing with ElevenLabs using language: {lang_code or 'auto-detect'}"
        )
        transcription = eleven_client.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",  # Currently only supported model
            tag_audio_events=True,  # Keep true if needed elsewhere, though not used in segmentation logic
            diarize=True,  # Enable speaker diarization is crucial
        )

        # Process the words array to build segments
        segments = []

        # Check if words array exists and is not empty
        if hasattr(transcription, "words") and transcription.words:
            # Initialize tracking variables
            current_segment_info = (
                None  # Stores start time and speaker for the current logical segment
            )
            current_speaker = None

            # Variables for sentence tracking within a segment
            prev_sentences_text = ""
            prev_sentences_words = []
            current_sentence_text = ""
            current_sentence_words = []

            # Helper function to finalize and add a segment
            def finalize_segment(text, words_list, start_time, end_time, speaker):
                if (
                    text.strip() and words_list
                ):  # Only add non-empty segments with words
                    segments.append(
                        {
                            "start": start_time,
                            "end": end_time,
                            "text": text.strip(),
                            "speaker": speaker,
                            "words": words_list,
                        }
                    )

            # Loop through all words from the API response
            num_words = len(transcription.words)
            for i, word in enumerate(transcription.words):
                # Skip spacing elements, but append their text if a sentence is active
                word_type = getattr(word, "type", None)
                if word_type == "spacing":
                    if current_sentence_words:  # Only add spacing if part of a sentence
                        spacing_text = getattr(word, "text", "")
                        current_sentence_text += spacing_text
                    continue

                # Safely get attributes
                word_start = getattr(word, "start", 0.0)
                word_end = getattr(word, "end", 0.0)
                word_text = getattr(word, "text", "")
                speaker_id = getattr(word, "speaker_id", "UNKNOWN")
                word_confidence = getattr(word, "confidence", 0.5)

                word_obj = {
                    "start": word_start,
                    "end": word_end,
                    "word": word_text,
                    "speaker": speaker_id,
                    "score": word_confidence,
                }

                # --- Speaker Change Logic ---
                speaker_changed = (
                    current_speaker is not None and speaker_id != current_speaker
                )

                if current_segment_info is None or speaker_changed:
                    # Finalize the previous segment before starting a new one
                    if current_segment_info is not None:
                        # Combine any remaining previous and current sentences for the old segment
                        final_text = prev_sentences_text + current_sentence_text
                        final_words = prev_sentences_words + current_sentence_words
                        last_word_end = 0.0
                        if final_words:
                            last_word_end = final_words[-1]["end"]
                        elif current_segment_info:
                            last_word_end = current_segment_info.get(
                                "start", 0.0
                            )  # Fallback

                        finalize_segment(
                            final_text,
                            final_words,
                            current_segment_info["start"],
                            last_word_end,
                            current_speaker,
                        )

                    # Start tracking a new logical segment
                    current_segment_info = {
                        "start": word_start,
                        # End time will be updated by finalize_segment
                        "speaker": speaker_id,
                    }
                    current_speaker = speaker_id

                    # Reset sentence tracking for the new segment
                    prev_sentences_text = ""
                    prev_sentences_words = []
                    current_sentence_text = ""
                    current_sentence_words = []

                # --- Sentence Building & Segmentation Logic ---
                # Add space before word if sentence isn't empty
                if current_sentence_text and not current_sentence_text.endswith(" "):
                    current_sentence_text += " "
                current_sentence_text += word_text
                current_sentence_words.append(word_obj)

                # Check if word ends a sentence or if it's the last word overall
                # Use rstrip to handle punctuation followed by space
                is_end_of_sentence = word_text.rstrip().endswith((".", "?", "!"))
                is_last_word_overall = i == num_words - 1

                if is_end_of_sentence or is_last_word_overall:
                    # Logic Point 3: Check if combining is possible within the current speaker's segment
                    if (
                        len(prev_sentences_text + current_sentence_text)
                        <= max_segment_length
                        or not prev_sentences_text
                    ):
                        # Combine current sentence with previous ones (or start prev if empty)
                        prev_sentences_text += current_sentence_text
                        prev_sentences_words.extend(current_sentence_words)
                    else:
                        # Cannot combine, finalize the previous part
                        finalize_segment(
                            prev_sentences_text,
                            prev_sentences_words,
                            current_segment_info["start"],
                            prev_sentences_words[-1]["end"],
                            current_speaker,
                        )
                        # The current sentence becomes the start of the *next* logical part
                        current_segment_info["start"] = current_sentence_words[0][
                            "start"
                        ]  # Update start time

                        # The current sentence now becomes the "previous" for the next check
                        prev_sentences_text = current_sentence_text
                        prev_sentences_words = current_sentence_words.copy()  # Use copy

                    # Reset current sentence tracking
                    current_sentence_text = ""
                    current_sentence_words = []

                    # Logic Point 2 (Simplified): If the *new* prev_sentences_text (which was the current sentence)
                    # is itself too long, we finalize it immediately.
                    if (
                        len(prev_sentences_text) > max_segment_length
                        and prev_sentences_words
                    ):
                        finalize_segment(
                            prev_sentences_text,
                            prev_sentences_words,
                            current_segment_info["start"],
                            prev_sentences_words[-1]["end"],
                            current_speaker,
                        )
                        # Reset prev as it's now finalized
                        prev_sentences_text = ""
                        prev_sentences_words = []
                        # Adjust segment start for the next potential part, if there is one
                        if i + 1 < num_words:
                            # Safely get next word's start time
                            next_word_start_time = getattr(
                                transcription.words[i + 1], "start", word_end
                            )
                            current_segment_info["start"] = next_word_start_time

            # Add the very last segment part after the loop finishes
            if current_segment_info is not None:
                # Combine any remaining parts
                final_text = prev_sentences_text + current_sentence_text
                final_words = prev_sentences_words + current_sentence_words
                if final_words:  # Ensure there are words to determine end time
                    finalize_segment(
                        final_text,
                        final_words,
                        current_segment_info["start"],
                        final_words[-1]["end"],
                        current_speaker,
                    )

        # Create result in the expected format
        detected_lang = getattr(transcription, "language_code", "en")  # Default to 'en'

        result = {"segments": segments, "language": detected_lang}

        return result

    except Exception as e:
        print(f"ElevenLabs transcription error: {e}")
        raise ValueError(f"ElevenLabs transcription error: {str(e)}")
