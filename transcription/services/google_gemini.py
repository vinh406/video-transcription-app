import os
import time
import google.genai.types as types
from google import genai
import csv
from io import StringIO

google_client = None

# Initialize Google client
if os.getenv("GOOGLE_API_KEY"):
    google_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    print("Google client initialized successfully")
else:
    print("Warning: GOOGLE_API_KEY not found in environment variables")

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
    """Transcribe audio using Google Gemini API with TSV output format"""
    if google_client is None:
        raise ValueError(
            "Google client not initialized. Please set GOOGLE_API_KEY in .env file."
        )

    # Import necessary libraries for audio processing
    from pydub import AudioSegment
    import tempfile
    import os

    # Define segment length (15 minutes in milliseconds)
    SEGMENT_LENGTH = 12 * 60 * 1000  # 12 minutes in milliseconds

    try:
        # Load the audio file
        audio = AudioSegment.from_file(file_path)
        total_duration = len(audio)

        # If file is shorter than segment length, process it directly
        if total_duration <= SEGMENT_LENGTH:
            return process_audio_segment(file_path, language)

        # Otherwise, split and process in segments
        segments_results = []

        for i, start_time in enumerate(range(0, total_duration, SEGMENT_LENGTH)):
            # Extract segment
            end_time = min(start_time + SEGMENT_LENGTH, total_duration)
            segment = audio[start_time:end_time]

            # Save segment to temp file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                segment_path = temp_file.name
                segment.export(segment_path, format="wav")

            try:
                # Process segment
                print(
                    f"Processing segment {i + 1}: {start_time / 1000}-{end_time / 1000} seconds"
                )
                segment_result = process_audio_segment(segment_path, language)

                # Adjust timestamps with the offset
                offset_in_seconds = start_time / 1000  # Convert ms to seconds
                for seg in segment_result["segments"]:
                    seg["start"] += offset_in_seconds
                    seg["end"] += offset_in_seconds

                # Add to results
                segments_results.extend(segment_result["segments"])
            finally:
                # Clean up temp file
                if os.path.exists(segment_path):
                    os.remove(segment_path)

        return {"segments": segments_results}

    except Exception as e:
        raise ValueError(f"Error processing audio: {str(e)}") from e


def process_audio_segment(file_path, language=None):
    """Process a single audio segment with Google Gemini API"""
    # Upload the file
    video = upload_video(file_path)

    system_instructions = """
    You are a transcription assistant specialized in multilingual audio processing.
    Your task is to transcribe the audio file provided to you accurately.
    """

    if language is not None and language != "auto":
        system_instructions = f"""
            You are an expert multilingual translation service.
            The provided audio file may contain segments spoken in different languages (e.g., English, Korean, Spanish, etc.).
            Your primary task is to translate ALL spoken content from this audio into ONE single target language: {language.upper()}.
            For example, if the audio contains both English and Korean speech, and the target language is {language.upper()}, you must translate the English speech to {language.upper()} AND the Korean speech to {language.upper()}.
            Output ONLY the translated text in {language.upper()}. Do not include any original language text or any other commentary.
            """

    system_instructions += """
    Return your response as TSV (Tab-Separated Values) with the following columns:
    start\tend\tspeaker\ttext
    
    The 'start' and 'end' columns must follow the format of MM:SS.
    Timestamps should have milli-second level accuracy.
    The 'speaker' column must indicate the speaker's name or use the format 'Speaker X'.
    You MUST include a header row.
    Each row must represent one segment.
    """

    # Construct the contents for the API request
    request_contents = [video]
    if language is not None and language != "auto":
        language_prompt_content = (
            f"Translate all speech in the provided audio to {language.upper()}."
        )
        request_contents.append(language_prompt_content)

    # Generate content
    response = google_client.models.generate_content_stream(
        model="gemini-2.5-flash-preview-04-17",
        contents=request_contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instructions,
            # thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    
    text = "\n"

    for chunk in response:
        if chunk.text is None:
            print(chunk)
            continue
        text += chunk.text
        print(chunk.text, end="")

    try:
        # Parse TSV response using csv module
        segments = []
        csv_reader = csv.reader(StringIO(text), delimiter="\t")

        for row in csv_reader:
            if not row:  # Skip empty rows
                continue

            # Handle cases with fewer than expected columns
            if len(row) >= 3:  # At minimum we need start, end, and text
                start_str = row[0]
                end_str = row[1]
                text_content = row[3]

                # Use default speaker if missing
                speaker = row[2] if len(row) >= 4 and row[3].strip() else "Unknown"

                try:
                    segment = {
                        "start": parse_timestamp(start_str),
                        "end": parse_timestamp(end_str),
                        "text": text_content,
                        "speaker": speaker,
                    }
                    segments.append(segment)
                except ValueError as ve:
                    print(f"Warning: Skipping row due to timestamp parsing error: {ve}")
                    continue

        result = {"segments": segments}

    except Exception as e:
        raise ValueError(f"Error parsing TSV from GenAI API: {text}") from e

    return result


def parse_timestamp(timestamp_str):
    """
    Convert a timestamp string in MM:SS format to seconds (float)

    Args:
        timestamp_str (str): Timestamp in MM:SS format

    Returns:
        float: Timestamp in seconds
    """
    parts = timestamp_str.split(":")
    if len(parts) == 3:
        minutes = int(parts[0])
        seconds = int(parts[1])
        milliseconds = int(parts[2])
    elif len(parts) == 2:
        minutes = int(parts[0])
        seconds = int(parts[1])
        milliseconds = 0
    else:
        raise ValueError(f"Invalid timestamp format: {timestamp_str}")

    # Convert to seconds
    total_seconds = minutes * 60 + seconds + milliseconds / 1000

    return total_seconds


def summarize_content(transcript_segments, video_title):
    """Generate a chapter-based summary of the transcribed content using Gemini API"""
    if google_client is None:
        raise ValueError(
            "Google client not initialized. Please set GOOGLE_API_KEY in .env file."
        )

    # Prepare the transcript text from segments with timestamps
    formatted_transcript = ""
    for segment in transcript_segments:
        formatted_transcript += (
            f"[{segment.start:.2f}s] {segment.speaker}: {segment.text}\n"
        )

    if video_title:
        title_prompt_part = f"The title of the content is: \"{video_title}\". Use this title for context if helpful.\n"

    summarization_prompt = f"""
    {title_prompt_part}
    Analyze and summarize the following content. Identify the main topics discussed and organize them into chapters:
    
    {formatted_transcript}
    """

    system_instruction = """
    You are an expert transcription analyzer that can organize long transcripts into logical chapters with key points.
    
    For this transcript:
    1. First, identify the primary language used in the transcript.
    2. Next, carefully analyze the entire content to understand the main topics and their sequence.
    3. Create a concise overview (2-3 sentences) that captures the overall content, written in the identified language.
    4. Divide the transcript into 3-5 logical chapters based on topic changes or natural transitions.
    5. For each chapter, provide the following, all written in the identified language:
       - A descriptive chapter title
       - The approximate start timestamp in the transcript (in seconds)
       - 2-4 key points that capture the important information in that chapter, each with its relevant timestamp (in seconds)

    Return your summary in TSV (Tab-Separated Values) format:
    
    LANGUAGE:\t<Identified language of the transcript>
    OVERVIEW:\t<A concise 2-3 sentence overview in the identified language>
    CHAPTER\t<Chapter 1 Title in identified language>\t<start timestamp in seconds>
    POINT\t<Key point 1 for Chapter 1 in identified language>\t<relevant timestamp in seconds>
    POINT\t<Key point 2 for Chapter 1 in identified language>\t<relevant timestamp in seconds>
    CHAPTER\t<Chapter 2 Title in identified language>\t<start timestamp in seconds>
    POINT\t<Key point 1 for Chapter 2 in identified language>\t<relevant timestamp in seconds>
    POINT\t<Key point 2 for Chapter 2 in identified language>\t<relevant timestamp in seconds>
    ...
    
    Guidelines:
    - The identified language MUST be specified on the first line.
    - The overview, chapter titles, and key points MUST be in the identified language.
    - The overview should capture the main theme without being too long.
    - Chapter titles should be short, descriptive phrases that clearly indicate the topic.
    - Key points should be specific and informative, not vague.
    - Timestamps should be provided as decimal numbers in seconds (e.g., 145.2).
    - If you can't determine a precise timestamp for a point, provide your best estimate.
    - Ensure chapter divisions make logical sense based on topic transitions.
    """

    try:
        response = google_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=summarization_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )

        text_response = response.text.strip()

        try:
            # Parse the TSV response using CSV reader
            summary_data = {"overview": "", "chapters": []}
            current_chapter = None
            csv_reader = csv.reader(StringIO(text_response), delimiter="\t")

            for row in csv_reader:
                if not row or not row[0].strip():  # Skip empty rows
                    continue

                row_type = row[0].strip()

                # Handle the overview row
                if row_type.startswith("OVERVIEW:"):
                    overview = row[0].replace("OVERVIEW:", "").strip()
                    # If there's a value in the next column, use it
                    if len(row) > 1 and row[1].strip():
                        overview = row[1].strip()
                    summary_data["overview"] = overview

                # Handle chapter headings
                elif row_type == "CHAPTER" and len(row) >= 3:
                    chapter_title = row[1].strip()
                    timestamp_str = row[2].strip()

                    try:
                        timestamp = float(timestamp_str)
                        current_chapter = {
                            "title": chapter_title,
                            "timestamp": timestamp,
                            "points": [],
                        }
                        summary_data["chapters"].append(current_chapter)
                    except ValueError:
                        # If timestamp can't be converted, still create the chapter
                        current_chapter = {"title": chapter_title, "points": []}
                        summary_data["chapters"].append(current_chapter)

                # Handle key points
                elif (
                    row_type == "POINT"
                    and len(row) >= 3
                    and current_chapter is not None
                ):
                    point_text = row[1].strip()
                    timestamp_str = row[2].strip()

                    try:
                        timestamp = float(timestamp_str)
                        current_chapter["points"].append(
                            {"text": point_text, "timestamp": timestamp}
                        )
                    except ValueError:
                        # If timestamp can't be converted, add point without timestamp
                        current_chapter["points"].append({"text": point_text})
            return summary_data

        except Exception as e:
            raise ValueError(
                f"Error parsing chapter-based summary from GenAI API: {text_response}"
            ) from e

    except Exception as e:
        print(f"Error generating chapter-based summary: {e}")
        return {
            "overview": "Failed to generate summary.",
            "chapters": [],
            "success": False,
            "error": str(e),
        }
