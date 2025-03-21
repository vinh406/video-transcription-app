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

model_name = "models/gemini-2.0-flash-thinking-exp"

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
    SEGMENT_LENGTH = 15 * 60 * 1000  # 15 minutes in milliseconds

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
    You are a transcription assistant. Your task is to transcribe the audio file provided to you.
    Return your response as TSV (Tab-Separated Values) with the following columns:
    start\tend\ttext\tspeaker
    
    The 'start' and 'end' columns must follow the format of MM:SS.mmm.
    Timestamps should have milli-second level accuracy.
    """
    if language is not None and language != "auto":
        system_instructions += f"""
        The text must be translated to {language}.
        """
    system_instructions += """
    The 'speaker' column must indicate the speaker's name or use the format 'Speaker X'.
    DO NOT include a header row.
    Each row must represent one segment.
    """

    prompt = "Transcribe the following audio file with correct timestamps"

    # Generate content
    response = google_client.models.generate_content_stream(
        model=model_name,
        contents=[video, prompt],
        config=types.GenerateContentConfig(
            system_instruction=system_instructions,
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
                text_content = row[2]

                # Use default speaker if missing
                speaker = row[3] if len(row) >= 4 and row[3].strip() else "Unknown"

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
    Convert a timestamp string in MM:SS.mmm format to seconds (float)

    Args:
        timestamp_str (str): Timestamp in MM:SS.mmm format

    Returns:
        float: Timestamp in seconds
    """
    parts = timestamp_str.split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid timestamp format: {timestamp_str}")

    minutes = int(parts[0])
    seconds_parts = parts[1].split(".")

    seconds = int(seconds_parts[0])
    milliseconds = int(seconds_parts[1]) if len(seconds_parts) > 1 else 0

    # Convert to seconds
    total_seconds = minutes * 60 + seconds + milliseconds / 1000

    return total_seconds


def summarize_content(transcript_segments):
    """Generate a summary of the transcribed content using Gemini API with TSV format"""
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

    summarization_prompt = f"""
    Please provide a summary of the following transcript:
    
    {formatted_transcript}
    """

    system_instruction = """
    You are an AI assistant specialized in summarizing transcribed content.
    Provide a summary that captures the main points of the transcript in TSV format.
    
    First, provide a single row with the overall summary prefixed with "OVERVIEW:".
    Then, provide key points, one per row, with each row having two tab-separated columns:
    1. The summary point text
    2. The timestamp in seconds where this information appears (as a decimal number, not a string)
    
    The summary must be in the same language as the transcript.
    
    Format:
    OVERVIEW:\t<overview text>
    <point text>\t<timestamp>
    <point text>\t<timestamp>
    ...
    """

    try:
        response = google_client.models.generate_content(
            model=model_name,
            contents=summarization_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction, max_output_tokens=64000
            ),
        )

        text_response = response.text.strip()

        try:
            # Parse the TSV response using CSV reader
            summary_data = {"summary_points": []}
            csv_reader = csv.reader(StringIO(text_response), delimiter="\t")

            for row in csv_reader:
                if not row:  # Skip empty rows
                    continue

                # Handle the overview row
                if row[0].startswith("OVERVIEW:"):
                    overview = row[0].replace("OVERVIEW:", "").strip()
                    # If there's a value in the next column, use it
                    if len(row) > 1 and row[1].strip():
                        overview = row[1].strip()
                    summary_data["overview"] = overview
                # Handle summary points
                elif len(row) >= 2:
                    text = row[0].strip()
                    timestamp_str = row[1].strip()

                    try:
                        timestamp = float(timestamp_str)
                        summary_data["summary_points"].append(
                            {"text": text, "timestamp": timestamp}
                        )
                    except ValueError:
                        # If timestamp can't be converted to float, use text only
                        summary_data["summary_points"].append({"text": text})

            return summary_data

        except Exception as e:
            raise ValueError(
                f"Error parsing TSV from GenAI API: {text_response}"
            ) from e

    except Exception as e:
        print(f"Error generating summary: {e}")
        return {
            "summary": "Failed to generate summary.",
            "success": False,
            "error": str(e),
        }
