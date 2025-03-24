import { useState, useRef } from "react";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { SummaryPanel } from "../components/SummaryPanel";
import { MediaPlayer, MediaPlayerHandle } from "@/components/MediaPlayer";
import { Segment } from "@/types/segment";
import { SummaryData } from "@/types/summary";

interface AudioLayoutProps {
    audioUrl: string;
    transcript: Segment[];
    summaries: SummaryData[];
    onSummarize: () => void;
    isSummarizing: boolean;
    onDeleteSummary: (summaryId: string) => void;
}

export default function AudioLayout({
    audioUrl,
    transcript,
    summaries,
    onSummarize,
    isSummarizing,
    onDeleteSummary,
}: AudioLayoutProps) {
    const [currentTime, setCurrentTime] = useState(0);
    const [showSummary, setShowSummary] = useState(summaries ? true : false);
    const mediaPlayerRef = useRef<MediaPlayerHandle>(null);

    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
    };

    const handleSummarize = () => {
        onSummarize();
        setShowSummary(true);
    };

    const handleDeleteSummary = async (summaryId: string): Promise<void> => {
        return onDeleteSummary(summaryId);
    };

    // This function will seek the audio player to the specified time
    const handleSeek = (time: number) => {
        if (mediaPlayerRef.current) {
            mediaPlayerRef.current.seekTo(time);
        }
    };

    return (
        <div className="flex-1 flex flex-col relative">
            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Content layout remains unchanged */}
                {showSummary ? (
                    <>
                        <div className="flex-1 h-140 overflow-auto border-r">
                            <div className="p-4">
                                <TranscriptPanel
                                    transcript={transcript}
                                    currentTime={currentTime}
                                    onSeek={handleSeek}
                                />
                            </div>
                        </div>
                        <div className="w-2/5 h-140 overflow-auto">
                            <div className="p-4">
                                <SummaryPanel
                                    summaries={summaries}
                                    isLoading={isSummarizing}
                                    onTimestampClick={handleSeek}
                                    onSummarize={handleSummarize}
                                    onDeleteSummary={handleDeleteSummary}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 h-140 overflow-auto">
                        <div className="p-4 flex flex-col gap-4">
                            <SummaryPanel
                                summaries={summaries}
                                isLoading={isSummarizing}
                                onTimestampClick={handleSeek}
                                onSummarize={handleSummarize}
                                onDeleteSummary={handleDeleteSummary}
                            />
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
