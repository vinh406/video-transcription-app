import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AudioLayout from "@/layouts/AudioLayout";
import VideoLayout from "@/layouts/VideoLayout";
import { summarizeTranscript } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { Segment } from "@/types/segment";

interface ViewPageState {
    mediaType: "audio" | "video";
    mediaUrl: string;
    transcript: Segment[];
    fileName: string;
}

export function ViewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const state = location.state as ViewPageState;

    // Redirect if there's no state (direct navigation to this page)
    useEffect(() => {
        if (!state) {
            navigate("/");
        }
    }, [state, navigate]);

    if (!state) {
        return null;
    }

    const { mediaType, mediaUrl, transcript, fileName } = state;

    const handleSummarize = async () => {
        if (!transcript) return;

        setIsSummarizing(true);
        try {
            const data = await summarizeTranscript(transcript);
            setSummary(data.summary_data || data.summary);
        } catch (error) {
            console.error("Summarization failed:", error);
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="h-screen flex flex-col">
            <header className="flex items-center justify-between border-b p-4">
                <div className="flex items-center space-x-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate("/")}
                        title="Back to upload"
                    >
                        <ArrowLeft size={18} />
                    </Button>
                    <h1 className="text-xl font-medium">{fileName}</h1>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/")}
                    className="flex items-center gap-2"
                >
                    <UploadCloud size={16} />
                    Upload New
                </Button>
            </header>

            <div className="flex-1">
                {mediaType === "audio" && (
                    <AudioLayout
                        audioUrl={mediaUrl}
                        transcript={transcript}
                        summary={summary}
                        onSummarize={handleSummarize}
                        isSummarizing={isSummarizing}
                    />
                )}

                {mediaType === "video" && (
                    <VideoLayout
                        videoUrl={mediaUrl}
                        transcript={transcript}
                        summary={summary}
                        onSummarize={handleSummarize}
                        isSummarizing={isSummarizing}
                    />
                )}
            </div>
        </div>
    );
}
