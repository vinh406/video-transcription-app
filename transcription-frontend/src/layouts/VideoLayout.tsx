import { useState, useRef } from "react";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { SummaryPanel } from "../components/SummaryPanel";
import { Segment } from "@/types/segment";
import { MediaPlayer, MediaPlayerHandle } from "@/components/MediaPlayer";
import { SummaryData } from "@/types/summary";

interface VideoLayoutProps {
    videoUrl: string;
    isYoutube: boolean;
    transcript: Segment[];
    summaries: SummaryData[];
    onSummarize: () => void;
    isSummarizing: boolean;
    onDeleteSummary: (summaryId: string) => void;
}

export default function VideoLayout({
    videoUrl,
    isYoutube,
    transcript,
    summaries,
    onSummarize,
    isSummarizing,
    onDeleteSummary,
}: VideoLayoutProps) {
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

    const handleSeek = (time: number) => {
        if (mediaPlayerRef.current) {
            mediaPlayerRef.current.seekTo(time);
        }
    };

    return (
        <div className="flex flex-col">
            <div className="flex-1 flex h-full">
                <div className="w-3/5 h-155 flex flex-col">
                    <div className="w-full aspect-video">
                        <MediaPlayer
                            src={videoUrl}
                            type={isYoutube ? "youtube" : "video"}
                            onTimeUpdate={handleTimeUpdate}
                            ref={mediaPlayerRef}
                        />
                    </div>
                    {showSummary && (
                        <div className="flex-1 overflow-y-auto">
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
                <div className="w-2/5 h-155 flex flex-col border-l">
                    {!showSummary ? (
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex flex-col p-4 gap-4">
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
                    ) : (
                        <div className="flex-1 overflow-y-auto">
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
                    )}
                </div>
            </div>
        </div>
    );
}
