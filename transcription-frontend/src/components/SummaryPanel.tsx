import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { SummaryData } from "@/types/summary";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { SummaryPanelHeader } from "@/components/SummaryPanelHeader";

interface SummaryPanelProps {
    summaries: SummaryData[];
    isLoading: boolean;
    onTimestampClick?: (time: number) => void;
    onSummarize?: () => void;
    onDeleteSummary?: (summaryId: string) => Promise<void>;
    onToggleTranscriptPosition?: () => void;
    transcriptUnderSummary?: boolean;
}

export function SummaryPanel({
    summaries,
    isLoading,
    onTimestampClick,
    onSummarize,
    onDeleteSummary,
    onToggleTranscriptPosition,
    transcriptUnderSummary,
}: SummaryPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [localSummaries, setLocalSummaries] =
        useState<SummaryData[]>(summaries);

    useEffect(() => {
        if (!isDeleting) {
            setLocalSummaries(summaries);
        }
    }, [summaries, isDeleting]);

    const handlePrevTab = () => {
        setActiveTab((prev) => (prev > 0 ? prev - 1 : prev));
    };

    const handleNextTab = () => {
        setActiveTab((prev) =>
            prev < localSummaries.length - 1 ? prev + 1 : prev
        );
    };

    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (localSummaries.length === 0 || activeTab >= localSummaries.length) {
            return;
        }

        const summaryToDelete = localSummaries[activeTab];

        // Check if the summary has an id
        if (!summaryToDelete.id) {
            toast.error("Cannot delete summary without an ID");
            setShowDeleteDialog(false);
            return;
        }

        setIsDeleting(true);
        try {
            // If parent provides a delete handler, use it
            if (onDeleteSummary) {
                await onDeleteSummary(summaryToDelete.id);
            }

            // Update local state
            const updatedSummaries = [...localSummaries];
            updatedSummaries.splice(activeTab, 1);
            setLocalSummaries(updatedSummaries);

            // If we deleted the current tab and it was the last one, go to previous tab
            if (activeTab >= updatedSummaries.length && activeTab > 0) {
                setActiveTab(activeTab - 1);
            }

            toast.success("Summary deleted successfully");
        } catch (error) {
            console.error("Failed to delete summary:", error);
            toast.error("Failed to delete the summary. Please try again.");
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating summary...</p>
            </div>
        );
    }

    if (!localSummaries || localSummaries.length === 0) {
        return (
            <div className="flex justify-end h-full">
                {onSummarize && (
                    <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={onSummarize}
                    >
                        Generate Summary
                    </Button>
                )}
            </div>
        );
    }

    const content = (
        <>
            <SummaryPanelHeader
                summariesCount={localSummaries.length}
                activeTab={activeTab}
                isLoading={isLoading}
                onPrevTab={handlePrevTab}
                onNextTab={handleNextTab}
                onDelete={handleDeleteClick}
                onSummarize={onSummarize}
                onToggleTranscriptPosition={onToggleTranscriptPosition}
                transcriptUnderSummary={transcriptUnderSummary}
            />

            {localSummaries.length > 0 && (
                <SummaryContent
                    summary={localSummaries[activeTab]}
                    onTimestampClick={onTimestampClick}
                />
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Summary</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this summary? This
                            action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );

    // Multiple summaries or single summary - unified rendering
    return <div ref={containerRef}>{content}</div>;
}

function SummaryContent({
    summary,
    onTimestampClick,
}: {
    summary: SummaryData;
    onTimestampClick?: (time: number) => void;
}) {
    return (
        <div>
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
                        <AccordionItem key={index} value={`chapter-${index}`}>
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
                                                (point, pointIndex) => (
                                                    <li
                                                        key={pointIndex}
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
