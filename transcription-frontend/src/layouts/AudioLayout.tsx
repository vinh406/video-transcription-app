import { useState, useRef } from "react";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { SummaryPanel } from "../components/SummaryPanel";
import { MediaPlayer, MediaPlayerHandle } from "@/components/MediaPlayer";
import { Button } from "@/components/ui/button";
import { Segment } from "@/types/segment";

interface AudioLayoutProps {
    audioUrl: string | null;
    transcript: Segment[] | null;
    summary: string | null;
    onSummarize: () => void;
    isSummarizing: boolean;
}

export default function AudioLayout({
    audioUrl,
    transcript,
    summary,
    onSummarize,
    isSummarizing,
}: AudioLayoutProps) {
    const [currentTime, setCurrentTime] = useState(0);
    const [showSummary, setShowSummary] = useState(false);
    const mediaPlayerRef = useRef<MediaPlayerHandle>(null);

    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
    };

    const handleSummarize = () => {
        onSummarize();
        setShowSummary(true);
    };

    // This function will seek the audio player to the specified time
    const handleSeek = (time: number) => {
        if (mediaPlayerRef.current) {
            mediaPlayerRef.current.seekTo(time);
        }
    };

    return (
        <div className="flex-1 flex flex-col relative">
            {/* Header with summary button */}
            <div className="p-4 border-b bg-card">
                <div className="flex justify-between items-center">
                    <div>
                        {showSummary ? (
                            <h2 className="text-lg font-medium">
                                Transcript & Summary
                            </h2>
                        ) : (
                            <h2 className="text-lg font-medium">Transcript</h2>
                        )}
                    </div>
                    {transcript && (
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleSummarize}
                            disabled={!!summary || isSummarizing}
                        >
                            {isSummarizing
                                ? "Generating..."
                                : summary
                                ? "Summary Generated"
                                : "Generate Summary"}
                        </Button>
                    )}
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Content layout remains unchanged */}
                {showSummary ? (
                    <>
                        <div className="flex-1 h-120 overflow-auto border-r">
                            <div className="p-4">
                                <TranscriptPanel
                                    transcript={transcript}
                                    currentTime={currentTime}
                                    onSeek={handleSeek}
                                />
                            </div>
                        </div>
                        <div className="w-2/5 h-120 overflow-auto">
                            <div className="p-4">
                                <SummaryPanel
                                    summary={summary}
                                    isLoading={isSummarizing}
                                    onTimestampClick={handleSeek}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 h-120 overflow-auto">
                        <div className="p-4">
                            <TranscriptPanel
                                transcript={transcript}
                                currentTime={currentTime}
                                onSeek={handleSeek}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed media player at bottom */}
            <div className="h-20 bg-zinc-900 border-t border-zinc-800 fixed bottom-0 left-0 right-0">
                <MediaPlayer
                    src={audioUrl}
                    type="audio"
                    onTimeUpdate={handleTimeUpdate}
                    ref={mediaPlayerRef}
                />
            </div>

            {/* Space to ensure content isn't covered by fixed player */}
            <div className="h-20"></div>
        </div>
    );
}
