import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getMediaHistory,
    getMediaDetails,
    deleteTranscription,
    regenerateTranscription,
} from "@/lib/api";
import { getLanguageName, languageOptions } from "@/lib/languages";
import { getServiceName, serviceOptions } from "@/lib/services";

import {
    Loader2,
    FileAudio,
    FileVideo,
    Youtube,
    FileText,
    Globe,
    MoreVertical,
    RefreshCw,
    Trash2,
    Clock,
    AlertCircle,
} from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Estimated durations for different services (in minutes)
const SERVICE_DURATIONS = {
    whisperx: 5, // WhisperX takes about 5 minutes
    google: 8, // Google API is faster
    elevenlabs: 5, // ElevenLabs takes about 4 minutes
    default: 5, // Default fallback
};

interface TranscriptionItem {
    id: string;
    media_id: string;
    file_name: string;
    mime_type: string;
    created_at: string;
    service: string;
    language: string;
    status?: string;
    has_summary?: boolean;
}

interface MediaHistoryProps {
    limitCount?: number;
    showTitle?: boolean;
}

// Calculate progress percentage based on elapsed time
function calculateProgress(job: TranscriptionItem): number {
    // For pending jobs, return 0
    if (job.status === "pending") return 0;

    // Get the elapsed time in milliseconds
    const createdAt = new Date(job.created_at).getTime();
    const now = new Date().getTime();
    const elapsedMs = now - createdAt;

    // Convert to minutes
    const elapsedMinutes = elapsedMs / (1000 * 60);

    // Get estimated duration based on service
    const estimatedDuration =
        SERVICE_DURATIONS[job.service as keyof typeof SERVICE_DURATIONS] ||
        SERVICE_DURATIONS.default;

    // Calculate progress percentage
    const progress = Math.min(99, (elapsedMinutes / estimatedDuration) * 100);

    return progress;
}

export function MediaHistory({
    limitCount,
    showTitle = true,
}: MediaHistoryProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [allItems, setAllItems] = useState<TranscriptionItem[]>([]);
    const [itemsCache, setItemsCache] = useState<TranscriptionItem[]>([]);
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const navigate = useNavigate();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState<TranscriptionItem | null>(
        null
    );
    const [regenerateService, setRegenerateService] = useState("whisperx");
    const [regenerateLanguage, setRegenerateLanguage] = useState("auto");
    const [isProcessing, setIsProcessing] = useState(false);

    const [progressValues, setProgressValues] = useState<{
        [key: string]: number;
    }>({});

    useEffect(() => {

        const fetchAllTranscriptions = async () => {
            try {
                const response = await getMediaHistory();

                if (Array.isArray(response)) {
                    // Store the complete unfiltered response in the cache
                    setItemsCache(response);

                    let transcriptions = response;

                    // Calculate progress for processing items
                    const newProgressValues: { [key: string]: number } = {};
                    transcriptions.forEach((job) => {
                        if (job.status === "processing") {
                            newProgressValues[job.id] = calculateProgress(job);
                        } else if (job.status === "pending") {
                            newProgressValues[job.id] = 0;
                        }
                    });
                    setProgressValues(newProgressValues);

                    // Apply limit if provided
                    transcriptions = limitCount
                        ? transcriptions.slice(0, limitCount)
                        : transcriptions;
                    setAllItems(transcriptions);
                }
            } catch (error) {
                console.error("Failed to fetch transcriptions", error);
                setAllItems([]);
                setItemsCache([]); // Clear cache on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllTranscriptions();

        // Poll for updates every 5 seconds
        const intervalId = setInterval(fetchAllTranscriptions, 5000);

        return () => clearInterval(intervalId);
    }, [navigate, limitCount]);

    // Update progress values every second for processing jobs
    useEffect(() => {
        const processingItems = allItems.filter(
            (item) => item.status === "processing"
        );
        if (processingItems.length === 0) return;

        const interval = setInterval(() => {
            const newProgressValues: { [key: string]: number } = {};
            processingItems.forEach((job) => {
                if (job.status === "processing") {
                    newProgressValues[job.id] = calculateProgress(job);
                } else if (job.status === "pending") {
                    newProgressValues[job.id] = 0;
                }
            });
            setProgressValues(newProgressValues);
        }, 1000);

        return () => clearInterval(interval);
    }, [allItems]);

    const handleMediaItemClick = async (item: TranscriptionItem) => {
        // Skip click for non-completed items
        if (item.status !== "completed") return;

        setIsLoading(true);
        try {
            const response = await getMediaDetails(item.id);

            let mediaType;
            if (response.is_youtube) {
                mediaType = "youtube";
            } else {
                mediaType = item.mime_type.startsWith("audio/")
                    ? "audio"
                    : "video";
            }

            navigate("/view", {
                state: {
                    mediaType,
                    mediaUrl: response.media_url,
                    isYoutube: response.is_youtube,
                    transcript: response.data.segments,
                    fileName: item.file_name,
                    transcriptionId: response.transcription_id,
                    summary: response.summary,
                },
            });
        } catch (error) {
            console.error("Failed to fetch transcription details", error);
            toast.error("Could not load transcription");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedItem) return;

        setIsProcessing(true);
        try {
            await deleteTranscription(selectedItem.id);

            // Remove the item from cache
            const updatedCache = itemsCache.filter(
                (item) => item.id !== selectedItem.id
            );
            setItemsCache(updatedCache);

            // Update the display items, pulling from cache if needed
            let updatedItems = allItems.filter(
                (item) => item.id !== selectedItem.id
            );

            // If we need to maintain a certain count and have more items in cache
            if (
                limitCount &&
                updatedItems.length < limitCount &&
                updatedCache.length > limitCount
            ) {
                // Get up to limitCount items
                updatedItems = updatedCache.slice(0, limitCount);
            }

            setAllItems(updatedItems);
            toast.success("Transcription deleted successfully");
        } catch (error) {
            console.error("Failed to delete transcription", error);
            toast.error("Failed to delete transcription");
        } finally {
            setIsProcessing(false);
            setShowDeleteDialog(false);
            setSelectedItem(null);
        }
    };

    const handleRegenerate = async () => {
        if (!selectedItem) return;

        setIsProcessing(true);
        try {
            const response = await regenerateTranscription(
                selectedItem.id,
                regenerateService,
                regenerateLanguage
            );
            if (!response.error) {
                toast.success("Transcription regenerated successfully");
            }

            if (selectedItem.status === "failed") {
                await deleteTranscription(selectedItem.id);

                // Remove from cache first
                const updatedCache = itemsCache.filter(
                    (item) => item.id !== selectedItem.id
                );
                setItemsCache(updatedCache);

                // Then update display items and replenish from cache if needed
                let updatedItems = allItems.filter(
                    (item) => item.id !== selectedItem.id
                );

                if (
                    limitCount &&
                    updatedItems.length < limitCount &&
                    updatedCache.length > limitCount
                ) {
                    // Get up to limitCount items
                    updatedItems = updatedCache.slice(0, limitCount);
                }

                setAllItems(updatedItems);
            }
        } catch (error) {
            console.error("Failed to regenerate transcription", error);
            toast.error("Failed to regenerate transcription");
        } finally {
            setIsProcessing(false);
            setShowRegenerateDialog(false);
            setSelectedItem(null);
        }
    };

    const handleOpenDeleteDialog = (
        e: React.MouseEvent,
        item: TranscriptionItem
    ) => {
        e.stopPropagation();
        setSelectedItem(item);
        setShowDeleteDialog(true);
    };

    const handleOpenRegenerateDialog = (
        e: React.MouseEvent,
        item: TranscriptionItem
    ) => {
        e.stopPropagation();
        setSelectedItem(item);
        setRegenerateService("whisperx");
        setRegenerateLanguage("auto");
        setShowRegenerateDialog(true);
    };

    // Get items based on active filter
    const getFilteredItems = () => {
        if (activeFilter === "all") return allItems;
        return allItems.filter((item) => item.status === activeFilter);
    };

    // Count by status
    const completedCount = allItems.filter(
        (item) => item.status === "completed"
    ).length;
    const processingCount = allItems.filter(
        (item) => item.status === "processing"
    ).length;
    const pendingCount = allItems.filter(
        (item) => item.status === "pending"
    ).length;
    const failedCount = allItems.filter(
        (item) => item.status === "failed"
    ).length;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (allItems.length === 0) {
        return (
            <div className="text-center p-8 border rounded-md bg-muted/10">
                <p className="text-muted-foreground">
                    No transcriptions found.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload a file to get started!
                </p>
            </div>
        );
    }

    const filteredItems = getFilteredItems();

    return (
        <div className="space-y-4">
            {showTitle && (
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-medium">Your Transcriptions</h2>
                    <div className="flex gap-2">
                        <Button
                            variant={
                                activeFilter === "all" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setActiveFilter("all")}
                        >
                            All ({allItems.length})
                        </Button>
                        {completedCount > 0 && (
                            <Button
                                variant={
                                    activeFilter === "completed"
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                onClick={() => setActiveFilter("completed")}
                            >
                                Completed ({completedCount})
                            </Button>
                        )}
                        {processingCount > 0 && (
                            <Button
                                variant={
                                    activeFilter === "processing"
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                onClick={() => setActiveFilter("processing")}
                                className="flex items-center gap-1"
                            >
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Processing ({processingCount})
                            </Button>
                        )}
                        {pendingCount > 0 && (
                            <Button
                                variant={
                                    activeFilter === "pending"
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                onClick={() => setActiveFilter("pending")}
                                className="flex items-center gap-1"
                            >
                                <Clock className="h-3 w-3" />
                                Pending ({pendingCount})
                            </Button>
                        )}
                        {failedCount > 0 && (
                            <Button
                                variant={
                                    activeFilter === "failed"
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                onClick={() => setActiveFilter("failed")}
                                className="flex items-center gap-1"
                            >
                                <AlertCircle className="h-3 w-3" />
                                Failed ({failedCount})
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        className={`group relative flex flex-col ${
                            item.status === "completed" ? "cursor-pointer" : ""
                        } rounded-lg border overflow-hidden ${
                            item.status === "failed"
                                ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900"
                                : item.status === "pending"
                                ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900"
                                : item.status === "processing"
                                ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        } transition-all duration-300 hover:shadow-lg`}
                        onClick={() =>
                            item.status === "completed" &&
                            handleMediaItemClick(item)
                        }
                    >
                        {/* Card header with icon, service badge and options menu */}
                        <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                {/* Media type icon */}
                                <div
                                    className={`flex items-center justify-center w-8 h-6 rounded-md ${
                                        item.mime_type === "youtube"
                                            ? "bg-red-500"
                                            : item.mime_type.startsWith(
                                                  "audio/"
                                              )
                                            ? "bg-blue-500"
                                            : "bg-primary"
                                    }`}
                                >
                                    {item.mime_type === "youtube" ? (
                                        <Youtube className="w-5 h-5 text-white" />
                                    ) : item.mime_type.startsWith("audio/") ? (
                                        <FileAudio className="w-5 h-5 text-white" />
                                    ) : (
                                        <FileVideo className="w-5 h-5 text-white" />
                                    )}
                                </div>

                                {/* Service badge */}
                                <div
                                    className={`
                                    inline-flex items-center text-xs px-2 py-1 rounded-full
                                    ${
                                        item.service === "whisperx"
                                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                            : item.service === "google"
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                            : "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                                    }
                                `}
                                >
                                    {getServiceName(item.service)}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Date */}
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(
                                        item.created_at
                                    ).toLocaleDateString()}
                                </div>

                                {/* Options menu */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        asChild
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={(e) =>
                                                handleOpenRegenerateDialog(
                                                    e,
                                                    item
                                                )
                                            }
                                            className="cursor-pointer"
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Regenerate
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={(e) =>
                                                handleOpenDeleteDialog(e, item)
                                            }
                                            className="cursor-pointer text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="flex-1 p-4">
                            <h3 className="font-medium text-lg mb-3 line-clamp-2">
                                {item.file_name}
                            </h3>

                            <div className="flex flex-wrap gap-2 mt-auto">
                                <div className="inline-flex items-center text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                                    <Globe className="w-3 h-3 mr-1" />
                                    {getLanguageName(item.language)}
                                </div>

                                {item.has_summary && (
                                    <div className="inline-flex items-center text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-md">
                                        <FileText className="w-3 h-3 mr-1" />
                                        Summary
                                    </div>
                                )}

                                {/* Moved status indicator here */}
                                {item.status !== "completed" && (
                                    <div
                                        className={`
                                        inline-flex items-center text-xs px-2 py-1 rounded-md
                                        ${
                                            item.status === "processing"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                                                : item.status === "pending"
                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                                                : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                                        }
                                    `}
                                    >
                                        {item.status === "processing" ? (
                                            <>
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                Processing
                                            </>
                                        ) : item.status === "pending" ? (
                                            <>
                                                <Clock className="w-3 h-3 mr-1" />
                                                Pending
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                Failed
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Progress bar for processing items */}
                            {item.status === "processing" && (
                                <div className="flex items-center justify-between gap-2">
                                    <Progress
                                        value={progressValues[item.id] || 5}
                                        className="h-1"
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {Math.round(
                                            progressValues[item.id] || 0
                                        )}
                                        %
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Delete confirmation dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Transcription</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this transcription?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Regenerate dialog with service and language options */}
            <Dialog
                open={showRegenerateDialog}
                onOpenChange={setShowRegenerateDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Regenerate Transcription</DialogTitle>
                        <DialogDescription>
                            Select new service and language settings to
                            regenerate this transcription.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="service"
                                className="text-sm font-medium"
                            >
                                Transcription Service
                            </label>
                            <Select
                                value={regenerateService}
                                onValueChange={setRegenerateService}
                            >
                                <SelectTrigger id="service">
                                    <SelectValue placeholder="Select service" />
                                </SelectTrigger>
                                <SelectContent>
                                    {serviceOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <label
                                htmlFor="language"
                                className="text-sm font-medium"
                            >
                                Language
                            </label>
                            <Select
                                value={regenerateLanguage}
                                onValueChange={setRegenerateLanguage}
                            >
                                <SelectTrigger id="language">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {languageOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowRegenerateDialog(false)}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRegenerate}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Regenerate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
