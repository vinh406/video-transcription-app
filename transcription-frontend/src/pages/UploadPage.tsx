import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUpload } from "@/components/FileUpload";
import { MediaHistory } from "@/components/MediaHistory";
import { transcribeFile, transcribeYouTube } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogOut, User } from "lucide-react";
import { toast } from "sonner";

export function UploadPage() {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleFileUpload = async (
        file: File,
        service: string,
        language: string
    ) => {
        setIsTranscribing(true);

        try {
            // Determine media type
            const mediaType = file.type.startsWith("audio/")
                ? "audio"
                : "video";
            const mediaUrl = URL.createObjectURL(file);

            // Call API for transcription
            const response = await transcribeFile(file, service, language);
            toast.success("Transcription started successfully!");
            
            // Navigate to view page with state
            navigate("/view", {
                state: {
                    mediaType,
                    mediaUrl,
                    transcript: response.data.segments,
                    fileName: file.name,
                    transcriptionId: response.transcription_id,
                },
            });
        } catch (error) {
            console.error("Transcription failed:", error);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleYoutubeUpload = async (
        youtubeUrl: string,
        service: string,
        language: string
    ) => {
        setIsTranscribing(true);
        try {
            // Call API for YouTube transcription
            const response = await transcribeYouTube(
                youtubeUrl,
                service,
                language
            );
            toast.success("Transcription started successfully!");
            
            navigate("/view", {
                state: {
                    mediaType: "youtube",
                    mediaUrl: youtubeUrl,
                    isYoutube: true,
                    transcript: response.data.segments,
                    fileName: response.file_name,
                    transcriptionId: response.transcription_id,
                },
            });
        } catch (error) {
            console.error("Transcription failed:", error);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Transcription App</h1>
                {user ? (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <User size={16} />
                            <span>{user.username}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLogout}
                            className="flex items-center gap-2"
                        >
                            <LogOut size={16} />
                            Logout
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/login")}
                    >
                        Login
                    </Button>
                )}
            </div>

            <div className="space-y-8">
                <div className="border rounded-lg p-6 bg-card">
                    <h2 className="text-xl font-medium mb-4">Upload Media</h2>
                    <FileUpload
                        onUpload={handleFileUpload}
                        isLoading={isTranscribing}
                        onYoutubeUpload={handleYoutubeUpload}
                    />
                </div>

                <div className="border rounded-lg p-6">
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-medium">
                                Recent Media
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate("/history")}
                                className="flex items-center gap-1"
                            >
                                View All
                                <ArrowRight size={16} />
                            </Button>
                        </div>
                        {user ? (
                            <MediaHistory limitCount={3} showTitle={false} />
                        ) : (
                            <p className="text-gray-500">
                                Please login to view your media history.
                            </p>
                        )}
                    </>
                </div>
            </div>
        </div>
    );
}
