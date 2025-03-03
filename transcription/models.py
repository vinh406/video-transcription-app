from django.db import models
import uuid


class MediaFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to="uploads/")
    file_name = models.CharField(max_length=255)
    file_hash = models.CharField(max_length=128, unique=True)
    mime_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

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
