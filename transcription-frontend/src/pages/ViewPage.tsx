import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AudioLayout from "@/layouts/AudioLayout";
import VideoLayout from "@/layouts/VideoLayout";
import { summarizeTranscript, deleteSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { Segment } from "@/types/segment";
import { SummaryData } from "@/types/summary";

interface ViewPageState {
    mediaType: "audio" | "video" | "youtube";
    mediaUrl: string;
    isYoutube: boolean;
    transcript: Segment[];
    fileName: string;
    transcriptionId: string;
    summaries?: SummaryData[];
}

export function ViewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [summaries, setSummary] = useState(location.state?.summary || null);
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

    const { mediaType, mediaUrl, isYoutube, transcript, fileName } = state;

    const handleSummarize = async () => {
        if (!transcript) return;

        // Ensure we have a transcription ID
        if (!state.transcriptionId) {
            console.error("Missing transcription ID");
            return;
        }

        setIsSummarizing(true);
        try {
            const response = await summarizeTranscript(
                transcript,
                state.transcriptionId
            );
            setSummary(response.summary);
        } catch (error) {
            console.error("Summarization failed:", error);
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleDeleteSummary = async (summaryId: string) => {
        try {
            // Delete the summary using its ID
            await deleteSummary(state.transcriptionId, summaryId);

            // Update local state (remove the deleted summary)
            const updatedSummaries = summaries.filter((summary: SummaryData) => summary.id !== summaryId);
            setSummary(updatedSummaries);

        } catch (error) {
            console.error("Failed to delete summary:", error);
        }
    };

    return (
        <div className="h-screen flex flex-col">
            <header className="items-center justify-between border-b p-4 hidden md:flex">
                <div className="flex items-center space-x-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(-1)}
                        title="Back to upload"
                    >
                        <ArrowLeft size={18} />
                    </Button>
                    <h1 className="text-xl font-medium truncate">{fileName}</h1>
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
                        summaries={summaries}
                        onSummarize={handleSummarize}
                        isSummarizing={isSummarizing}
                        onDeleteSummary={handleDeleteSummary}
                    />
                )}

                {(mediaType === "video" || mediaType === "youtube") && (
                    <VideoLayout
                        videoUrl={mediaUrl}
                        isYoutube={isYoutube}
                        transcript={transcript}
                        summaries={summaries}
                        onSummarize={handleSummarize}
                        isSummarizing={isSummarizing}
                        onDeleteSummary={handleDeleteSummary}
                    />
                )}
            </div>
        </div>
    );
}
