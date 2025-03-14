from typing import List, Optional
from ninja import Schema


class Word(Schema):
    start: Optional[float] = None
    end: Optional[float] = None
    word: str
    speaker: Optional[str] = None
    score: Optional[float] = None


class Segment(Schema):
    start: float
    end: float
    text: str
    speaker: str
    words: Optional[List[Word]] = None

class GeminiSegment(Schema):
    start: str
    end: str
    text: str
    speaker: str

class SegmentResponseGemini(Schema):
    segments: List[GeminiSegment]


class SegmentResponse(Schema):
    segments: List[Segment]


class SummaryPoint(Schema):
    text: str
    timestamp: Optional[float] = None


class SummaryData(Schema):
    overview: str
    summary_points: Optional[List[SummaryPoint]] = None

class YouTubeTranscriptionRequest(Schema):
    youtube_url: str
    service: str
    language: str = "auto"


class TranscriptionRequest(Schema):
    service: str
    language: str = "auto"


class TranscriptionResult(Schema):
    message: str
    data: Optional[SegmentResponse] = None
    media_url: Optional[str] = None
    file_name: Optional[str] = None
    is_youtube: bool = False
    summary: Optional[SummaryData] = None
    transcription_id: Optional[str] = None


class SummarizeRequest(Schema):
    """Schema for summarize request body"""

    transcription_id: str
    segments: List[Segment]


class MediaFileSchema(Schema):
    id: str
    file_name: str
    mime_type: str
    created_at: str
    has_transcript: bool
    has_summary: bool
    service: Optional[str] = None


class ErrorResponse(Schema):
    message: str
