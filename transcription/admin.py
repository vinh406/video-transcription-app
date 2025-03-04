from django.contrib import admin
from .models import Transcription, MediaFile

@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ("file_name", "file_hash", "mime_type", "created_at")
    search_fields = ("file_name", "file_hash")
    list_filter = ("mime_type",)
    ordering = ("-created_at",)
@admin.register(Transcription)
class TranscriptionAdmin(admin.ModelAdmin):
    list_display = ("media_file", "service", "language", "created_at")
    search_fields = ("media_file__file_name", "service", "language")
    list_filter = ("service", "language")
    ordering = ("-created_at",)