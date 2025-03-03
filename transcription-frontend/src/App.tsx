import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UploadPage } from "./pages/UploadPage";
import { ViewPage } from "./pages/ViewPage";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<UploadPage />} />
                <Route path="/view" element={<ViewPage />} />
            </Routes>
        </BrowserRouter>
    );
}
