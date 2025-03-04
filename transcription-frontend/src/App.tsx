import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UploadPage } from "./pages/UploadPage";
import { ViewPage } from "./pages/ViewPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AuthProvider } from "./contexts/AuthContext";

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<UploadPage />} />
                    <Route path="/view" element={<ViewPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
