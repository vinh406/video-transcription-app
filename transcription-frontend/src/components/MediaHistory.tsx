import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getMediaHistory,
    getMediaDetails,
    deleteTranscription,
    regenerateTranscription,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MediaItem {
    id: string; // transcription ID
    media_id: string;
    file_name: string;
    mime_type: string;
    created_at: string;
    service: string;
    language: string;
    has_summary: boolean;
}

interface MediaHistoryProps {
    limitCount?: number;
    showTitle?: boolean;
}

export function MediaHistory({
    limitCount,
    showTitle = true,
}: MediaHistoryProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const [regenerateService, setRegenerateService] = useState("whisperx");
    const [regenerateLanguage, setRegenerateLanguage] = useState("auto");
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!user) {
            // Redirect to login if not authenticated
            navigate("/login");
            return;
        }

        const fetchMediaHistory = async () => {
            try {
                const response = await getMediaHistory();

                // If response is not an array, it's likely an error
                if (!Array.isArray(response)) {
                    console.error("Unexpected response format");
                    setMediaItems([]);
                    return;
                }

                // Apply limit if provided
                const items = limitCount
                    ? response.slice(0, limitCount)
                    : response;
                setMediaItems(items);
            } catch (error) {
                console.error("Failed to fetch media history", error);
                setMediaItems([]);
            } finally {
                setIsLoading(false);
            }
        };


        fetchMediaHistory();
    }, [user, navigate, limitCount]);

    const handleMediaItemClick = async (item: MediaItem) => {
        setIsLoading(true);
        try {
            // Use the transcription ID directly
            const response = await getMediaDetails(item.id);

            let mediaType;
            if (response.is_youtube) {
                mediaType = "youtube";
            } else {
                mediaType = item.mime_type.startsWith("audio/")
                    ? "audio"
                    : "video";
            }

            // Navigate to view page with the transcription data
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
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDeleteDialog = (
        e: React.MouseEvent,
        item: MediaItem
    ) => {
        e.stopPropagation(); // Prevent card click
        setSelectedItem(item);
        setShowDeleteDialog(true);
    };

    const handleOpenRegenerateDialog = (
        e: React.MouseEvent,
        item: MediaItem
    ) => {
        e.stopPropagation(); // Prevent card click
        setSelectedItem(item);
        setRegenerateService("whisperx"); // Default service
        setRegenerateLanguage("auto"); // Default language
        setShowRegenerateDialog(true);
    };

    const handleDelete = async () => {
        if (!selectedItem) return;

        setIsProcessing(true);
        try {
            await deleteTranscription(selectedItem.id);
            // Remove item from list
            setMediaItems((items) =>
                items.filter((i) => i.id !== selectedItem.id)
            );
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

            // Navigate to view page with the new transcription data
            navigate("/view", {
                state: {
                    mediaType:
                        selectedItem.mime_type === "youtube"
                            ? "youtube"
                            : selectedItem.mime_type.startsWith("audio/")
                            ? "audio"
                            : "video",
                    mediaUrl: response.media_url,
                    isYoutube: response.is_youtube,
                    transcript: response.data.segments,
                    fileName: response.file_name,
                    transcriptionId: response.transcription_id,
                    summary: response.summary,
                },
            });

            toast.success("Transcription regenerated successfully");
        } catch (error) {
            console.error("Failed to regenerate transcription", error);
            toast.error("Failed to regenerate transcription");
        } finally {
            setIsProcessing(false);
            setShowRegenerateDialog(false);
            setSelectedItem(null);
        }
    };


    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (mediaItems.length === 0) {
        return (
            <div className="text-center p-8 border rounded-md bg-muted/10">
                <p className="text-muted-foreground">
                    No previous transcriptions found.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload a file to get started!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {showTitle && (
                <h2 className="text-xl font-medium">Your Media History</h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaItems.map((item) => (
                    <div
                        key={item.id}
                        className="group relative flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:shadow-lg overflow-hidden cursor-pointer"
                        onClick={() => handleMediaItemClick(item)}
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
                                        <Youtube className="w-6 h-6 text-white" />
                                    ) : item.mime_type.startsWith("audio/") ? (
                                        <FileAudio className="w-6 h-6 text-white" />
                                    ) : (
                                        <FileVideo className="w-6 h-6 text-white" />
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

                                {/* Options menu - stop propagation to prevent card click */}
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

                        {/* Rest of the card content remains the same */}
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
                            </div>
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
