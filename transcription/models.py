# transcription/models.py
from django.db import models
import uuid
from django.contrib.auth.models import User

class MediaFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to='uploads/')
    file_name = models.CharField(max_length=255)
    file_hash = models.CharField(max_length=128, unique=True)
    mime_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    # Add user relationship
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, related_name='media_files')
    google_uri = models.URLField(null=True, blank=True)

    def __str__(self):
        return self.file_name

class Transcription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    media_file = models.ForeignKey(MediaFile, on_delete=models.CASCADE)
    service = models.CharField(max_length=20)  # google, elevenlabs, whisperx
    language = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    # Store the full transcription data as JSON
    segments = models.JSONField()

    def __str__(self):
        return f"{self.media_file.file_name} - {self.service}"

class Summary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transcription = models.ForeignKey(
        Transcription, on_delete=models.CASCADE, related_name="summaries"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Store the summary data as JSON
    content = models.JSONField()

    def __str__(self):
        return f"Summary for {self.transcription.media_file.file_name}"