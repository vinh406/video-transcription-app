import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SummaryData } from "@/types/summary";
import { formatTime } from "@/lib/utils";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface SummaryPanelProps {
    summary: SummaryData | null;
    isLoading: boolean;
    onTimestampClick?: (time: number) => void;
}

export function SummaryPanel({
    summary,
    isLoading,
    onTimestampClick,
}: SummaryPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Handle structured summary data
    return (
        <div ref={containerRef}>
            {summary.overview && (
                <div className="border-b pb-4">
                    <h3 className="font-medium text-lg mb-2">Overview</h3>
                    <p className="text-muted-foreground">{summary.overview}</p>
                </div>
            )}

            {summary.chapters && summary.chapters.length > 0 && (
                <Accordion
                    type="multiple"
                    defaultValue={summary.chapters.map(
                        (_, i) => `chapter-${i}`
                    )}
                    className="space-y-2"
                >
                    {summary.chapters.map((chapter, index) => (
                        <AccordionItem
                            key={index}
                            value={`chapter-${index}`}
                        >
                            <AccordionTrigger className="flex px-3 py-2 bg-muted/30 hover:no-underline">
                                <div className="flex items-center flex-1 text-left text-base">
                                    <div
                                        className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (
                                                chapter.timestamp !== undefined
                                            ) {
                                                onTimestampClick?.(
                                                    chapter.timestamp
                                                );
                                            }
                                        }}
                                        title="Jump to this chapter"
                                    >
                                        <span className="text-sm font-medium text-primary hover:underline">
                                            {formatTime(chapter.timestamp || 0)}
                                        </span>
                                    </div>
                                    <h4 className="font-medium">
                                        {chapter.title}
                                    </h4>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-3">
                                {chapter.points &&
                                    chapter.points.length > 0 && (
                                        <ul className="space-y-2">
                                            {chapter.points.map(
                                                (point, index) => (
                                                    <li
                                                        key={index}
                                                        className="text-sm"
                                                    >
                                                        {point.timestamp !==
                                                        undefined ? (
                                                            <div className="flex items-start gap-2">
                                                                <button
                                                                    className="text-left font-medium hover:underline"
                                                                    onClick={() =>
                                                                        onTimestampClick?.(
                                                                            point.timestamp!
                                                                        )
                                                                    }
                                                                >
                                                                    [
                                                                    {formatTime(
                                                                        point.timestamp
                                                                    )}
                                                                    ]
                                                                </button>
                                                                <span>
                                                                    {point.text}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span>
                                                                {point.text}
                                                            </span>
                                                        )}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}

            {!summary.chapters &&
                summary.summary_points &&
                summary.summary_points.length > 0 && (
                    <div className="space-y-2 mt-6">
                        <h3 className="font-medium text-lg mb-2">
                            Summary Points
                        </h3>
                        <ul className="space-y-2">
                            {summary.summary_points.map((point, index) => (
                                <li key={index}>
                                    {point.timestamp !== undefined ? (
                                        <div className="flex items-start gap-2">
                                            <button
                                                className="text-left font-medium hover:underline"
                                                onClick={() =>
                                                    onTimestampClick?.(
                                                        point.timestamp!
                                                    )
                                                }
                                            >
                                                [{formatTime(point.timestamp)}]
                                            </button>
                                            <span>{point.text}</span>
                                        </div>
                                    ) : (
                                        <span>{point.text}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
        </div>
    );
}
