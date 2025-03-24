export const API_BASE_URL = "http://127.0.0.1:8000/api";
import { fetchCsrfToken, clearCsrfToken } from "./csrfToken";

// Add this to handle requests that need CSRF protection
async function fetchWithCsrf(url: string, options: RequestInit = {}) {
    const token = await fetchCsrfToken();

    const headers = {
        ...options.headers,
        "X-CSRFToken": token,
    };

    return fetch(url, {
        ...options,
        headers,
        credentials: "include",
    });
}

export async function transcribeFile(
    file: File,
    service: string,
    language: string
) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("service", service);
    formData.append("language", language);

    const response = await fetchWithCsrf(`${API_BASE_URL}/transcription/transcribe`, {
        method: "POST",
        body: formData,
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Transcription failed with status: ${response.status}`);
    }

    return response.json();
}

export async function summarizeTranscript(
    segments: unknown[],
    transcriptionId: string
) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/transcription/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            transcription_id: transcriptionId,
            segments: segments,
        }),
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Summarization failed with status: ${response.status}`);
    }

    return response.json();
}
// Auth functions
export async function signup(
    username: string,
    email: string,
    password: string
) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
        credentials: "include",
    });

    const data = await response.json();
    return data;
}

export async function login(username: string, password: string) {
    clearCsrfToken();

    const response = await fetchWithCsrf(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
    });

    const data = await response.json();

    // After successful login, refresh the token again
    if (response.ok) {
        await fetchCsrfToken(true);
    }

    return data;
}

export async function logout() {
    const response = await fetchWithCsrf(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });

    const data = await response.json();

    // Clear the token after logout
    clearCsrfToken();

    return data;
}

export async function getCurrentUser() {
    const response = await fetchWithCsrf(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        // User is not authenticated or there was an error
        return { message: "Not authenticated", user: null };
    }

    const data = await response.json();
    return data;
}

// Media history
export async function getMediaHistory() {
    const response = await fetchWithCsrf(
        `${API_BASE_URL}/transcription/history`, // Updated endpoint
        {
            method: "GET",
            credentials: "include",
        }
    );
    return response.json();
}

export async function getMediaDetails(transcriptionId: string) {
    const response = await fetchWithCsrf(
        `${API_BASE_URL}/transcription/${transcriptionId}`, // Updated endpoint
        {
            method: "GET",
            credentials: "include",
        }
    );
    return response.json();
}
export async function transcribeYouTube(
    youtubeUrl: string,
    service: string,
    language: string
) {
    const response = await fetchWithCsrf(
        `${API_BASE_URL}/transcription/transcribe-youtube`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                youtube_url: youtubeUrl,
                service,
                language,
            }),
            credentials: "include",
        }
    );

    if (!response.ok) {
        throw new Error(
            `YouTube transcription failed with status: ${response.status}`
        );
    }

    return response.json();
}

export async function deleteTranscription(transcriptionId: string) {
    const response = await fetchWithCsrf(
        `${API_BASE_URL}/transcription/${transcriptionId}`,
        {
            method: "DELETE",
        }
    );

    if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
    }

    return response.json();
}

export async function regenerateTranscription(
    transcriptionId: string,
    service: string,
    language: string
) {
    const response = await fetchWithCsrf(
        `${API_BASE_URL}/transcription/${transcriptionId}/regenerate`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                service,
                language,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Regeneration failed with status: ${response.status}`);
    }

    return response.json();
}

export async function deleteSummary(
    transcriptionId: string,
    segmentId: string
) {
    const response = await fetchWithCsrf(
        `${API_BASE_URL}/transcription/${transcriptionId}/summary/${segmentId}`,
        {
            method: "DELETE",
        }
    );

    if (!response.ok) {
        throw new Error(`Delete summary failed with status: ${response.status}`);
    }

    return response.json();
}
