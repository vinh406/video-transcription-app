import { ArrowDownUp, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryPanelHeaderProps {
    summariesCount: number;
    activeTab: number;
    isLoading: boolean;
    onPrevTab: () => void;
    onNextTab: () => void;
    onDelete: () => void;
    onSummarize?: () => void;
    onToggleTranscriptPosition?: () => void;
    transcriptUnderSummary?: boolean;
}

export function SummaryPanelHeader({
    summariesCount,
    activeTab,
    isLoading,
    onPrevTab,
    onNextTab,
    onDelete,
    onSummarize,
    onToggleTranscriptPosition,
    transcriptUnderSummary,
}: SummaryPanelHeaderProps) {
    return (
        <div className="mb-4 flex justify-between items-center">
            {onToggleTranscriptPosition ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleTranscriptPosition}
                    className="flex items-center gap-1 ml-2"
                >
                    <ArrowDownUp size={16} />
                    {transcriptUnderSummary
                        ? "Hide Transcript"
                        : "Show Transcript"}
                </Button>
            ) : <div></div>}

            <div className="flex items-center gap-2">
                {summariesCount > 1 ? (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrevTab}
                            disabled={activeTab === 0}
                            className="h-8 w-8"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <span className="text-sm">
                            {activeTab + 1}/{summariesCount}
                        </span>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNextTab}
                            disabled={activeTab === summariesCount - 1}
                            className="h-8 w-8"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDelete}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Delete summary"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    null
                )}
                {onSummarize && (
                    <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={onSummarize}
                        disabled={isLoading}
                    >
                        Regenerate Summary
                    </Button>
                )}
            </div>
        </div>
    );
}
