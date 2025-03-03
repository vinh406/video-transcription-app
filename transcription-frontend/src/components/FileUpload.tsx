import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
    onUpload: (file: File, service: string, language: string) => void;
    isLoading: boolean;
}

export function FileUpload({ onUpload, isLoading }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [service, setService] = useState<string>("whisperx");
    const [language, setLanguage] = useState<string>("auto");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setFile(event.target.files[0]);
        }
    };

    const handleUploadClick = () => {
        if (file) {
            onUpload(file, service, language);
        } else if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="flex flex-wrap gap-4 items-end">
            <div
                className={cn(
                    "border-2 border-dashed rounded-lg p-6 cursor-pointer flex flex-col items-center justify-center min-w-64",
                    file ? "border-primary" : "border-muted",
                    "hover:border-primary transition-colors"
                )}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    id="mediaFile"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="audio/*,video/*"
                    className="hidden"
                />
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    {file
                        ? file.name
                        : "Drop media file here or click to browse"}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="serviceSelect" className="text-sm font-medium">
                    Transcription Service
                </label>
                <Select
                    value={service}
                    onValueChange={setService}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="whisperx">
                            WhisperX (Local)
                        </SelectItem>
                        <SelectItem value="google">Google Gemini</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="languageSelect" className="text-sm font-medium">
                    Language
                </label>
                <Select
                    value={language}
                    onValueChange={setLanguage}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="it">Italian</SelectItem>
                        <SelectItem value="vi">Vietnamese</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button
                onClick={handleUploadClick}
                disabled={isLoading || (!file && !fileInputRef.current)}
                className="px-6"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : file ? (
                    "Transcribe"
                ) : (
                    "Select File"
                )}
            </Button>
        </div>
    );
}
