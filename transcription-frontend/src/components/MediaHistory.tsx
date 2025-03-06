// src/components/MediaHistory.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMediaHistory, getMediaDetails } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

import {
    Loader2,
    FileAudio,
    FileVideo,
    Youtube,
    MessageSquareText,
    FileText,
} from "lucide-react";

interface MediaItem {
    id: string;
    file_name: string;
    mime_type: string;
    created_at: string;
    has_transcript: boolean;
    has_summary: boolean;
    service: string | null;
}

export function MediaHistory() {
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

                setMediaItems(response);
            } catch (error) {
                console.error("Failed to fetch media history", error);
                setMediaItems([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMediaHistory();
    }, [user, navigate]);

    const handleMediaItemClick = async (mediaItem: MediaItem) => {
        if (!mediaItem.has_transcript) return;

        setIsLoading(true);
        try {
            const response = await getMediaDetails(mediaItem.id);

            let mediaType;
            if (response.is_youtube) {
                mediaType = "youtube";
            } else {
                mediaType = mediaItem.mime_type.startsWith("audio/")
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
                    fileName: mediaItem.file_name,
                    fromHistory: true,
                },
            });
        } catch (error) {
            console.error("Failed to fetch media details", error);
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
            <h2 className="text-xl font-medium">Your Media History</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaItems.map((item) => (
                    <div
                        key={item.id}
                        className="border rounded-lg p-4 hover:bg-accent/20 cursor-pointer transition-colors"
                        onClick={() => handleMediaItemClick(item)}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex-shrink-0">
                                {item.mime_type === "youtube" ? (
                                    <Youtube className="w-5 h-5 text-red-500" />
                                ) : item.mime_type.startsWith("audio/") ? (
                                    <FileAudio className="w-5 h-5 text-primary" />
                                ) : (
                                    <FileVideo className="w-5 h-5 text-primary" />
                                )}
                            </div>
                            <span className="font-medium truncate max-w-[calc(100%-2rem)]">
                                {item.file_name}
                            </span>
                        </div>
                        <div className="text-sm text-muted-foreground mb-3">
                            {new Date(item.created_at).toLocaleDateString()}
                            {" • "}
                            {item.service || "unknown"}
                        </div>

                        <div className="flex gap-2">
                            {item.has_transcript && (
                                <div className="inline-flex items-center text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                                    <MessageSquareText className="w-3 h-3 mr-1" />
                                    Transcript
                                </div>
                            )}
                            {item.has_summary && (
                                <div className="inline-flex items-center text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2 py-1 rounded-full">
                                    <FileText className="w-3 h-3 mr-1" />
                                    Summary
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
