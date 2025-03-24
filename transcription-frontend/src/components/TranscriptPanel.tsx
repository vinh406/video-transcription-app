import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";

interface Word {
    start: number;
    end: number;
    word: string;
    speaker: string;
    score?: number;
}

interface Segment {
    start: number;
    end: number;
    text: string;
    speaker: string;
    words?: Word[];
}

interface TranscriptPanelProps {
    transcript: Segment[];
    currentTime: number;
    onSeek: (time: number) => void;
}

export function TranscriptPanel({
    transcript,
    currentTime,
    onSeek,
}: TranscriptPanelProps) {
    const activeSegmentRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the active segment
    useEffect(() => {
        if (activeSegmentRef.current) {
            activeSegmentRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [currentTime]);

    return (
        <div className="space-y-4">
            {transcript.map((segment, segmentIndex) => {
                const isActive =
                    currentTime >= segment.start && currentTime <= segment.end;

                return (
                    <div
                        key={`${segment.start}-${segmentIndex}`}
                        ref={isActive ? activeSegmentRef : null}
                        className={cn(
                            "p-3 rounded-md border transition-colors",
                            isActive
                                ? "bg-primary/10 border-primary/50"
                                : "border-transparent hover:bg-accent/10"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <button
                                onClick={() => onSeek(segment.start)}
                                className="text-primary font-medium hover:underline"
                            >
                                [{formatTime(segment.start)}]
                            </button>

                            <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded-full">
                                {segment.speaker || "Unknown"}
                            </span>
                        </div>

                        <div>
                            {segment.words ? (
                                <div className="space-x-1">
                                    {segment.words.map((word, i) => (
                                        <span
                                            key={i}
                                            onClick={() => onSeek(word.start)}
                                            className={cn(
                                                "cursor-pointer inline-block rounded px-0.5",
                                                currentTime >= word.start &&
                                                    currentTime <= word.end
                                                    ? "bg-primary/20 text-primary-foreground"
                                                    : "hover:bg-accent/20"
                                            )}
                                        >
                                            {word.word}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p>{segment.text}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
