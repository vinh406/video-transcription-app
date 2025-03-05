import os
import tempfile
from pytubefix import YouTube


def download_youtube_audio(youtube_url):
    """
    Download audio from a YouTube video

    Args:
        youtube_url (str): URL of the YouTube video

    Returns:
        tuple: (temp_file_path, title, mime_type)
    """
    try:
        # Create YouTube object
        yt = YouTube(youtube_url)

        # Get audio stream with highest quality
        audio_stream = yt.streams.filter(only_audio=True).order_by("abr").desc().first()

        if not audio_stream:
            raise ValueError("No audio stream found for this YouTube video")

        # Create temp file for the audio
        temp_dir = tempfile.mkdtemp()
        temp_file = os.path.join(temp_dir, f"{yt.video_id}.{audio_stream.subtype}")

        # Download the audio stream
        audio_stream.download(
            output_path=temp_dir, filename=f"{yt.video_id}.{audio_stream.subtype}"
        )

        # Return the file path, video title, and mime type
        return temp_file, f"audio/{audio_stream.subtype}"

    except Exception as e:
        raise ValueError(f"Failed to download YouTube audio: {str(e)}")

def get_youtube_video_id(youtube_url):
    """
    Extract the video ID from a YouTube URL

    Args:
        youtube_url (str): URL of the YouTube video

    Returns:
        str: Video ID
    """
    try:
        yt = YouTube(youtube_url)
        return yt.video_id, yt.title
    except Exception as e:
        raise ValueError(f"Failed to extract video ID: {str(e)}")