const API_BASE_URL = "http://localhost:8000/api";

export async function transcribeFile(
    file: File,
    service: string,
    language: string
) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("service", service);
    formData.append("language", language);

    const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Transcription failed with status: ${response.status}`);
    }

    return response.json();
}

export async function summarizeTranscript(segments: unknown[]) {
    const response = await fetch(`${API_BASE_URL}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
    });

    if (!response.ok) {
        throw new Error(`Summarization failed with status: ${response.status}`);
    }

    return response.json();
}
