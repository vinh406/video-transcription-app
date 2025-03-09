from django.contrib import admin
from .models import Summary, Transcription, MediaFile

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
@admin.register(Summary)
class SummaryAdmin(admin.ModelAdmin):
    list_display = ("get_media_name", "created_at")
    search_fields = ("transcription__media_file__file_name",)
    ordering = ("-created_at",)

    def get_media_name(self, obj):
        return obj.transcription.media_file.file_name

    get_media_name.short_description = "Media"
    get_media_name.admin_order_field = "transcription__media_file__file_name"