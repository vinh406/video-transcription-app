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
import { languageOptions } from "@/lib/languages";
import { serviceOptions } from "@/lib/services";

interface FileUploadProps {
    onUpload: (file: File, service: string, language: string) => void;
    onYoutubeUpload: (
        youtubeUrl: string,
        service: string,
        language: string
    ) => void;
    isLoading: boolean;
}

export function FileUpload({
    onUpload,
    onYoutubeUpload,
    isLoading,
}: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [youtubeUrl, setYoutubeUrl] = useState<string>("");
    const [service, setService] = useState<string>("whisperx");
    const [language, setLanguage] = useState<string>("auto");
    const [inputType, setInputType] = useState<"file" | "youtube">("file");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setFile(event.target.files[0]);
        }
    };

    const handleUploadClick = () => {
        if (inputType === "file" && file) {
            onUpload(file, service, language);
        } else if (inputType === "youtube" && youtubeUrl) {
            onYoutubeUpload(youtubeUrl, service, language);
        } else if (inputType === "file" && fileInputRef.current) {
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
        <div className="space-y-4">
            <div className="flex gap-2 mb-4">
                <Button
                    variant={inputType === "file" ? "default" : "outline"}
                    onClick={() => setInputType("file")}
                >
                    Upload File
                </Button>
                <Button
                    variant={inputType === "youtube" ? "default" : "outline"}
                    onClick={() => setInputType("youtube")}
                >
                    YouTube URL
                </Button>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
                {inputType === "file" ? (
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-lg p-6 cursor-pointer flex flex-col items-center justify-center w-76 h-28",
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
                        <p className="text-sm text-muted-foreground w-full truncate">
                            {file
                                ? file.name
                                : "Drop media file here or click to browse"}
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-medium mb-1 block">
                            YouTube URL
                        </label>
                        <input
                            type="url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full p-2.5 border rounded-md"
                        />
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="serviceSelect"
                        className="text-sm font-medium"
                    >
                        Transcription Service
                    </label>
                    <Select value={service} onValueChange={setService}>
                        <SelectTrigger className="w-[180px]">
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

                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="languageSelect"
                        className="text-sm font-medium"
                    >
                        Language
                    </label>
                    <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-[180px]">
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

                <Button
                    onClick={handleUploadClick}
                    disabled={
                        isLoading ||
                        (inputType === "file" &&
                            !file &&
                            !fileInputRef.current) ||
                        (inputType === "youtube" && !youtubeUrl)
                    }
                    className="px-6"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : inputType === "youtube" ? (
                        youtubeUrl ? (
                            "Transcribe YouTube"
                        ) : (
                            "Enter URL"
                        )
                    ) : file ? (
                        "Transcribe"
                    ) : (
                        "Select File"
                    )}
                </Button>
            </div>
        </div>
    );
}