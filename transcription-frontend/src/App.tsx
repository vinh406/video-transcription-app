import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UploadPage } from "./pages/UploadPage";
import { ViewPage } from "./pages/ViewPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AuthProvider } from "./contexts/AuthContext";
import { HistoryPage } from "./pages/HistoryPage";
import { useEffect } from "react";
import { fetchCsrfToken } from "./lib/csrfToken";

export default function App() {
    useEffect(() => {
        // Fetch CSRF token when app starts
        fetchCsrfToken().catch((error) =>
            console.error("Failed to fetch CSRF token:", error)
        );
    }, []);

    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<UploadPage />} />
                    <Route path="/view" element={<ViewPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
