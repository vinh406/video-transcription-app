import { JSX, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SummaryPoint {
    text: string;
    timestamp?: number;
}

interface SummaryData {
    overview?: string;
    summary_points?: SummaryPoint[];
}

interface SummaryPanelProps {
    summary: string | SummaryData | null;
    isLoading: boolean;
    onTimestampClick?: (time: number) => void;
}

export function SummaryPanel({
    summary,
    isLoading,
    onTimestampClick,
}: SummaryPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Extract timestamp references from text [00:00] or [00]
    const extractTimestamps = (text: string): JSX.Element => {
        if (!text) return <>{text}</>;

        // Match both [XX:XX] and [XX] formats
        const parts = text.split(/(\[\d+(?::\d+)?\]|\[\d+\.\d+\])/g);

        return (
            <>
                {parts.map((part, index) => {
                    // Check if this part is a timestamp
                    const timestampMatch = part.match(
                        /\[(\d+(?::\d+)?)\]|\[(\d+\.\d+)\]/
                    );

                    if (timestampMatch) {
                        const timestampStr =
                            timestampMatch[1] || timestampMatch[2];
                        let seconds = 0;

                        // Convert to seconds based on format
                        if (timestampStr.includes(":")) {
                            const [min, sec] = timestampStr
                                .split(":")
                                .map(Number);
                            seconds = min * 60 + sec;
                        } else {
                            seconds = parseFloat(timestampStr);
                        }

                        return (
                            <span
                                key={index}
                                className="inline-block px-1.5 py-0.5 bg-primary/20 text-primary rounded cursor-pointer hover:bg-primary/30"
                                onClick={() => onTimestampClick?.(seconds)}
                            >
                                {part}
                            </span>
                        );
                    }

                    return <span key={index}>{part}</span>;
                })}
            </>
        );
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating summary...</p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground text-center mb-4">
                    No summary available yet.
                </p>
                <Button disabled>Generate Summary</Button>
            </div>
        );
    }

    // Handle string summary (older format)
    if (typeof summary === "string") {
        return (
            <div ref={containerRef} className="prose prose-sm max-w-none">
                {extractTimestamps(summary)}
            </div>
        );
    }

    // Handle structured summary data
    return (
        <div ref={containerRef} className="space-y-6">
            {summary.overview && (
                <div className="border-b pb-4">
                    <h3 className="font-medium text-lg mb-2">Overview</h3>
                    <p className="text-muted-foreground">{summary.overview}</p>
                </div>
            )}

            {summary.summary_points && summary.summary_points.length > 0 && (
                <div>
                    <h3 className="font-medium text-lg mb-3">Key Points</h3>
                    <ul className="space-y-3 list-disc pl-5">
                        {summary.summary_points.map((point, index) => (
                            <li key={index} className="pl-1">
                                {point.timestamp !== undefined ? (
                                    <div className="flex items-start gap-1">
                                        <div className="flex-1">
                                            {point.text}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-primary shrink-0 h-6"
                                            onClick={() =>
                                                onTimestampClick?.(
                                                    point.timestamp!
                                                )
                                            }
                                        >
                                            [{formatTime(point.timestamp)}]
                                        </Button>
                                    </div>
                                ) : (
                                    extractTimestamps(point.text)
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// Format time in MM:SS format
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
