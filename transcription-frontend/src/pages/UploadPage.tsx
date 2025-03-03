import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUpload } from "@/components/FileUpload";
import { transcribeFile } from "@/lib/api";

export function UploadPage() {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const navigate = useNavigate();

    const handleFileUpload = async (
        file: File,
        service: string,
        language: string
    ) => {
        setIsTranscribing(true);

        try {
            // Determine media type
            const mediaType = file.type.startsWith("audio/")
                ? "audio"
                : "video";
            const mediaUrl = URL.createObjectURL(file);

            // Call API for transcription
            const response = await transcribeFile(file, service, language);

            // Navigate to view page with state
            navigate("/view", {
                state: {
                    mediaType,
                    mediaUrl,
                    transcript: response.data.segments,
                    fileName: file.name,
                },
            });
        } catch (error) {
            console.error("Transcription failed:", error);
            setIsTranscribing(false);
        }
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <h1 className="text-2xl font-bold mb-6">Upload Media</h1>
            <FileUpload
                onUpload={handleFileUpload}
                isLoading={isTranscribing}
            />
        </div>
    );
}
