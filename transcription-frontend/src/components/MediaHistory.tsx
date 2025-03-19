import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMediaHistory, getMediaDetails } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getLanguageName } from "@/lib/languages";
import { getServiceName } from "@/lib/services";

import {
    Loader2,
    FileAudio,
    FileVideo,
    Youtube,
    FileText,
    Globe,
} from "lucide-react";

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
                        {/* Card header with icon and service badge */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
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

                            {/* Date in more prominent position */}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(item.created_at).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Card content */}
                        <div className="flex-1 p-4">
                            {/* Title with better spacing */}
                            <h3 className="font-medium text-lg mb-3 line-clamp-2">
                                {item.file_name}
                            </h3>

                            {/* Tags in a more organized layout */}
                            <div className="flex flex-wrap gap-2 mt-auto">
                                {/* Language badge */}
                                <div className="inline-flex items-center text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                                    <Globe className="w-3 h-3 mr-1" />
                                    {getLanguageName(item.language)}
                                </div>

                                {/* Summary badge if exists */}
                                {item.has_summary && (
                                    <div className="inline-flex items-center text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-md">
                                        <FileText className="w-3 h-3 mr-1" />
                                        Summary
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subtle hover effect */}
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                ))}
            </div>
        </div>
    );
}
