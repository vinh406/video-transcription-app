import { useState, useRef } from "react";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { SummaryPanel } from "../components/SummaryPanel";
import { VideoPlayer } from "../components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Segment } from "@/types/segment";
import { YouTubePlayer } from "../components/YouTubePlayer";

interface VideoLayoutProps {
    videoUrl: string | null;
    isYoutube: boolean;
    transcript: Segment[] | null;
    summary: string | null;
    onSummarize: () => void;
    isSummarizing: boolean;
}

export default function VideoLayout({
    videoUrl,
    isYoutube,
    transcript,
    summary,
    onSummarize,
    isSummarizing,
}: VideoLayoutProps) {
    const [currentTime, setCurrentTime] = useState(0);
    const [showSummary, setShowSummary] = useState(false);
    const videoPlayerRef = useRef<HTMLVideoElement>(null);

    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
    };

    const handleSummarize = () => {
        onSummarize();
        setShowSummary(true);
    };

    const handleSeek = (time: number) => {
        if (videoPlayerRef.current) {
            videoPlayerRef.current.currentTime = time;
        }
    };

    return (
        <div className="flex flex-col">
            {!showSummary ? (
                // Initial layout: Video on left, transcript on right
                <div className="flex-1 flex">
                    <div className="w-3/5 h-full flex items-center justify-center bg-black">
                        <div className="w-full aspect-video">
                            {isYoutube ? (
                                <YouTubePlayer
                                    videoId={videoUrl}
                                    onTimeUpdate={handleTimeUpdate}
                                />
                            ) : (
                                <VideoPlayer
                                    src={videoUrl}
                                    onTimeUpdate={handleTimeUpdate}
                                    ref={videoPlayerRef}
                                />
                            )}
                        </div>
                    </div>
                    <div className="w-2/5 h-155 flex flex-col border-l">
                        <div className="p-4 border-b bg-card">
                            {transcript && !summary && (
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleSummarize}
                                >
                                    Generate Summary
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-4">
                                <TranscriptPanel
                                    transcript={transcript}
                                    currentTime={currentTime}
                                    onSeek={handleSeek}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // After summarize: Video on left top, transcript below it, summary on right
                <div className="flex-1 flex h-full">
                    <div className="w-3/5 h-155 flex flex-col">
                        <div className="aspect-video bg-black">
                            <div className="w-full aspect-video">
                                {isYoutube ? (
                                    <YouTubePlayer
                                        videoId={videoUrl}
                                        onTimeUpdate={handleTimeUpdate}
                                    />
                                ) : (
                                    <VideoPlayer
                                        src={videoUrl}
                                        onTimeUpdate={handleTimeUpdate}
                                        ref={videoPlayerRef}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-4">
                                <TranscriptPanel
                                    transcript={transcript}
                                    currentTime={currentTime}
                                    onSeek={handleSeek}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="w-2/5 h-155 flex flex-col border-l">
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-4">
                                <SummaryPanel
                                    summary={summary}
                                    isLoading={isSummarizing}
                                    onTimestampClick={handleSeek}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
