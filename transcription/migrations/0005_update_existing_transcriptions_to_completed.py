from django.db import migrations


def mark_transcriptions_as_completed(apps, schema_editor):
    """Mark all existing transcriptions as completed"""
    Transcription = apps.get_model("transcription", "Transcription")
    # Only update transcriptions that have segments (meaning they were completed successfully)
    # and those that currently have the default 'pending' status
    Transcription.objects.filter(segments__isnull=False, status="pending").update(
        status="completed"
    )


def reverse_migration(apps, schema_editor):
    """Reverse operation - mark all back to pending (though this is unlikely to be needed)"""
    Transcription = apps.get_model("transcription", "Transcription")
    Transcription.objects.filter(status="completed").update(status="pending")


class Migration(migrations.Migration):
    dependencies = [
        (
            "transcription",
            "0004_transcription_error_message_transcription_status_and_more",
        ),
    ]

    operations = [
        migrations.RunPython(mark_transcriptions_as_completed, reverse_migration),
    ]
