from django.contrib import admin
from .models import Transcription, MediaFile

@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    pass    
@admin.register(Transcription)
class TranscriptionAdmin(admin.ModelAdmin):
    pass