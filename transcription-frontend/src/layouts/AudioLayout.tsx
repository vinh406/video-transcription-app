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
        <div className="flex flex-col h-screen md:h-[calc(100vh-4rem)]">
            <div className="flex-1 flex overflow-hidden">
                {showSummary ? (
                    <>
                        <div className="flex-1 overflow-auto border-r">
                            <div className="p-4">
                                <TranscriptPanel
                                    transcript={transcript}
                                    currentTime={currentTime}
                                    onSeek={handleSeek}
                                />
                            </div>
                        </div>
                        <div className="w-2/5 overflow-auto">
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
                    <div className="flex-1 overflow-auto">
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
            <div className="h-18 bg-zinc-900 border-t border-zinc-800">
                <MediaPlayer
                    src={audioUrl}
                    type="audio"
                    onTimeUpdate={handleTimeUpdate}
                    ref={mediaPlayerRef}
                />
            </div>
        </div>
    );
}
