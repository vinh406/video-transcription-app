import json
import os
import time
import google.genai.types as types
from google import genai
from ..schemas import SegmentResponseGemini, SummaryData

google_client = None

# Initialize Google client
if os.getenv("GOOGLE_API_KEY"):
    google_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    print("Google client initialized successfully")
else:
    print("Warning: GOOGLE_API_KEY not found in environment variables")

model_name = "models/gemini-2.0-pro-exp-02-05"

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

    # Upload the file
    video = upload_video(file_path)
    system_instructions = """
    You are a transcription assistant. Your task is to transcribe the audio file provided to you.
    Your response must be a JSON object containing 'segments' field.
    The 'segments' field must be a list of objects with 'start', 'end', 'text' and 'speaker' fields.
    The 'start' and 'end' must follow the format of MM:SS.mmm.
    Timestamps should have milli-second level accuracy.
    The 'speaker' field must be a string indicating the speaker's name or in the format 'Speaker X'.
    """
    prompt = (
        "Transcribe the following audio file with correct timestamps"
    )
    
    if language is not None and language != "auto":
        prompt += f" and translate it to {language}."

    # Generate content
    response = google_client.models.generate_content(
        model=model_name,
        contents=[video, prompt],
        config=types.GenerateContentConfig(
            system_instruction=system_instructions,
            response_mime_type="application/json",
            response_schema=SegmentResponseGemini,
        ),
    )

    text = response.text.strip()

    try:
        result = json.loads(text)

        # Convert timestamps from MM:SS.mmm format to float seconds
        if "segments" in result:
            for segment in result["segments"]:
                if "start" in segment and isinstance(segment["start"], str):
                    segment["start"] = parse_timestamp(segment["start"])
                if "end" in segment and isinstance(segment["end"], str):
                    segment["end"] = parse_timestamp(segment["end"])

    except json.JSONDecodeError as e:
        raise ValueError(f"Error decoding JSON from GenAI API: {response.text}") from e

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
    """Generate a summary of the transcribed content using Gemini API with timestamp references"""
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
    
    For each key point in your summary, include a reference to the timestamp (in seconds) 
    where this information appears in the transcript. Format each point as:
    
    - Point summary text [timestamp]
    """

    system_instruction = """
    You are an AI assistant specialized in summarizing transcribed content.
    Provide a summary that captures the main points of the transcript in JSON format.
    The summary should be in the same language as the transcript.
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
      "overview": "Overall summary of the content."
    }

    Ensure timestamps are provided as numbers, not strings.
    """

    try:
        response = google_client.models.generate_content(
            model=model_name,
            contents=summarization_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=SummaryData,
            ),
        )

        text_response = response.text.strip()

        try:
            # Parse the JSON response
            summary_data = json.loads(text_response)
            return summary_data
        except json.JSONDecodeError as e:
            raise ValueError(
                f"Error decoding JSON from GenAI API: {text_response}"
            ) from e

    except Exception as e:
        print(f"Error generating summary: {e}")
        return {
            "summary": "Failed to generate summary.",
            "success": False,
            "error": str(e),
        }
