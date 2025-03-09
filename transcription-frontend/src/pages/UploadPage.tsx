import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUpload } from "@/components/FileUpload";
import { MediaHistory } from "@/components/MediaHistory";
import { transcribeFile, transcribeYouTube } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

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
            console.error("YouTube transcription failed:", error);
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

            <Tabs defaultValue="upload" className="mb-8">
                <TabsList className="mb-4">
                    <TabsTrigger value="upload">Upload New</TabsTrigger>
                    <TabsTrigger value="history">Media History</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4">
                    <FileUpload
                        onUpload={handleFileUpload}
                        isLoading={isTranscribing}
                        onYoutubeUpload={handleYoutubeUpload}
                    />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <MediaHistory />
                </TabsContent>
            </Tabs>
        </div>
    );
}
