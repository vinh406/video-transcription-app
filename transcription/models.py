# transcription/models.py
from django.db import models
import uuid
from django.contrib.auth.models import User
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django_q.models import Task

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
    task_id = models.CharField(max_length=255, null=True, blank=True, help_text="Django Q task ID")

    # New fields for tracking status
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    error_message = models.TextField(blank=True, null=True)

    # Store the full transcription data as JSON
    segments = models.JSONField(null=True, blank=True)  # Allow null for pending tasks

    def __str__(self):
        return f"{self.media_file.file_name} - {self.service}"

@receiver(pre_delete, sender=Transcription)
def delete_transcription_task(sender, instance, **kwargs):
    """
    Deletes the associated Django Q task if the transcription is deleted
    before completion.
    """
    if instance.task_id:
        try:
            # Delete the task from Django Q
            task = Task.objects.get(id=instance.task_id)
            task.delete()
        except Exception as e:
            print(f"Error deleting Django Q task {instance.task_id} for transcription {instance.id}: {e}")


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