let csrfToken: string | null = null;

/**
 * Fetches a CSRF token from the server and stores it for use in API requests
 */
export async function fetchCsrfToken(): Promise<string> {
    if (csrfToken) {
        return csrfToken;
    }

    await fetch("http://127.0.0.1:8000/api/csrf", {
        method: "POST",
        credentials: "include",
    });

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "csrftoken") {
            csrfToken = value;
            return value;
        }
    }
    throw new Error("CSRF token not found in response or cookies");
}
