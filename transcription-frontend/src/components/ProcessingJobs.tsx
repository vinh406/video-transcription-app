import { useState, useEffect } from "react";
import {
    getTasks,
    deleteTranscription,
    regenerateTranscription,
} from "@/lib/api";
import {
    Loader2,
    FileAudio,
    FileVideo,
    Youtube,
    AlertCircle,
    RefreshCw,
} from "lucide-react";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { getServiceName } from "@/lib/services";
import { getLanguageName } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProcessingJob {
    id: string;
    media_id: string;
    file_name: string;
    mime_type: string;
    created_at: string;
    service: string;
    language: string;
    status: string;
}

// Storage key for accordion state
const ACCORDION_STATE_KEY = "processing-jobs-accordion-state";

// Estimated durations for different services (in minutes)
const SERVICE_DURATIONS = {
    whisperx: 5, // WhisperX takes about 5 minutes
    google: 8, // Google API is faster
    elevenlabs: 5, // ElevenLabs takes about 4 minutes
    default: 5, // Default fallback
};

// Calculate progress percentage based on elapsed time
function calculateProgress(job: ProcessingJob): number {
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
    const progress = Math.min(100, (elapsedMinutes / estimatedDuration) * 100);

    return progress;
}

export function ProcessingJobs() {
    const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [retryingJobs, setRetryingJobs] = useState<{
        [key: string]: boolean;
    }>({});
    const [progressValues, setProgressValues] = useState<{
        [key: string]: number;
    }>({});

    // Initialize with empty array (closed state) by default
    const [isOpen, setIsOpen] = useState<string[]>(() => {
        // Try to get state from localStorage on component mount
        try {
            const savedState = localStorage.getItem(ACCORDION_STATE_KEY);
            return savedState ? JSON.parse(savedState) : [];
        } catch (error) {
            console.error(
                "Failed to load accordion state from localStorage",
                error
            );
            return [];
        }
    });

    // Update localStorage when accordion state changes
    useEffect(() => {
        try {
            localStorage.setItem(ACCORDION_STATE_KEY, JSON.stringify(isOpen));
        } catch (error) {
            console.error(
                "Failed to save accordion state to localStorage",
                error
            );
        }
    }, [isOpen]);

    const fetchProcessingJobs = async () => {
        try {
            // Get all processing jobs
            const response = await getTasks();

            if (Array.isArray(response)) {
                // Include both processing and failed jobs
                setProcessingJobs(response);

                // Update progress values
                const newProgressValues: { [key: string]: number } = {};
                response.forEach((job) => {
                    if (job.status === "processing") {
                        newProgressValues[job.id] = calculateProgress(job);
                    }
                });
                setProgressValues(newProgressValues);
            }
        } catch (error) {
            console.error("Failed to fetch processing jobs", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Update progress values every second for processing jobs
    useEffect(() => {
        if (processingJobs.length === 0) return;

        const interval = setInterval(() => {
            const newProgressValues: { [key: string]: number } = {};
            processingJobs.forEach((job) => {
                if (job.status === "processing") {
                    newProgressValues[job.id] = calculateProgress(job);
                }
            });
            setProgressValues(newProgressValues);
        }, 1000);

        return () => clearInterval(interval);
    }, [processingJobs]);

    useEffect(() => {
        fetchProcessingJobs();

        // Set up polling to refresh every 5 seconds
        const intervalId = setInterval(() => {
            fetchProcessingJobs();
        }, 5000);

        return () => clearInterval(intervalId);
    }, []);

    // Function to handle retrying a failed job
    const handleRetryJob = async (job: ProcessingJob, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle

        if (retryingJobs[job.id]) return; // Prevent double clicks

        try {
            // Mark this job as retrying
            setRetryingJobs((prev) => ({ ...prev, [job.id]: true }));

            // Step 1: Create a new transcription job with the same parameters
            await regenerateTranscription(job.id, job.service, job.language);

            // Step 2: Delete the failed job
            await deleteTranscription(job.id);

            // Refresh the job list
            fetchProcessingJobs();

            toast.success("Transcription job restarted successfully");
        } catch (error) {
            console.error("Failed to retry transcription job", error);
            toast.error("Failed to restart transcription job");
        } finally {
            // Remove the retrying status
            setRetryingJobs((prev) => {
                const updated = { ...prev };
                delete updated[job.id];
                return updated;
            });
        }
    };

    // Count jobs by status
    const processingCount = processingJobs.filter(
        (job) => job.status === "processing"
    ).length;
    const failedCount = processingJobs.filter(
        (job) => job.status === "failed"
    ).length;

    // Don't render anything if there are no jobs
    if (
        (processingJobs.length === 0 && !isLoading) ||
        (isLoading && processingJobs.length === 0)
    ) {
        return null;
    }

    return (
        <div className="fixed bottom-0 right-4 z-50 w-80">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-lg rounded-t-xl overflow-hidden">
                <Accordion
                    type="multiple"
                    value={isOpen}
                    onValueChange={setIsOpen}
                    className="w-full"
                >
                    <AccordionItem
                        value="processing-jobs"
                        className="border-none"
                    >
                        <AccordionTrigger className="px-2 py-2 hover:no-underline text-amber-600 hover:bg-amber-100/50 dark:hover:bg-amber-900/30">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                    {isLoading ? (
                                        "Processing Jobs (...)"
                                    ) : (
                                        <span>
                                            {processingCount > 0 && (
                                                <span className="text-amber-700 dark:text-amber-400">
                                                    <Loader2 className="inline h-4 w-4 mr-1 animate-spin text-amber-600" />
                                                    Processing (
                                                    {processingCount})
                                                </span>
                                            )}
                                            {failedCount > 0 && (
                                                <span className="text-red-600 dark:text-red-400 ml-1">
                                                    <AlertCircle className="inline h-4 w-4 mr-1" />
                                                    Failed ({failedCount})
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="overflow-y-auto max-h-[60vh] py-0">
                            <div>
                                {isLoading && processingJobs.length === 0 ? (
                                    <div className="flex justify-center py-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    </div>
                                ) : (
                                    processingJobs.map((job) => (
                                        <div
                                            key={job.id}
                                            className={`bg-white dark:bg-black/20 border ${
                                                job.status === "failed"
                                                    ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10"
                                                    : "border-amber-100 dark:border-amber-900"
                                            } p-2 w-full`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`flex items-center justify-center w-5 h-5 rounded-md ${
                                                        job.mime_type ===
                                                        "youtube"
                                                            ? "bg-red-500"
                                                            : job.mime_type.startsWith(
                                                                  "audio/"
                                                              )
                                                            ? "bg-blue-500"
                                                            : "bg-primary"
                                                    }`}
                                                >
                                                    {job.mime_type ===
                                                    "youtube" ? (
                                                        <Youtube className="w-3 h-3 text-white" />
                                                    ) : job.mime_type.startsWith(
                                                          "audio/"
                                                      ) ? (
                                                        <FileAudio className="w-3 h-3 text-white" />
                                                    ) : (
                                                        <FileVideo className="w-3 h-3 text-white" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between w-full">
                                                        <h4 className="text-xs font-medium line-clamp-1 w-50">
                                                            {job.file_name}
                                                        </h4>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(
                                                                job.created_at
                                                            ).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        {job.status ===
                                                            "failed" && (
                                                            <AlertCircle className="w-3 h-3 text-red-500" />
                                                        )}
                                                        <span
                                                            className={
                                                                job.status ===
                                                                "failed"
                                                                    ? "text-red-500"
                                                                    : ""
                                                            }
                                                        >
                                                            {getServiceName(
                                                                job.service
                                                            )}{" "}
                                                            |{" "}
                                                            {getLanguageName(
                                                                job.language
                                                            )}
                                                            {job.status ===
                                                                "failed" &&
                                                                " • Failed"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        {job.status !==
                                                        "failed" ? (
                                                            <>
                                                                <Progress
                                                                    className="h-1 flex-1"
                                                                    value={
                                                                        progressValues[
                                                                            job
                                                                                .id
                                                                        ] || 5
                                                                    }
                                                                />
                                                                <span className="text-[9px] text-muted-foreground ml-1 w-7 text-right">
                                                                    {Math.round(
                                                                        progressValues[
                                                                            job
                                                                                .id
                                                                        ] || 0
                                                                    )}
                                                                    %
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="h-1 flex-1 bg-red-200 dark:bg-red-900/30 rounded-full" />
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-5 px-2 text-[10px] ml-1 text-red-600 hover:text-red-700 hover:bg-red-100"
                                                                    onClick={(
                                                                        e
                                                                    ) =>
                                                                        handleRetryJob(
                                                                            job,
                                                                            e
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        retryingJobs[
                                                                            job
                                                                                .id
                                                                        ]
                                                                    }
                                                                >
                                                                    {retryingJobs[
                                                                        job.id
                                                                    ] ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <RefreshCw className="h-3 w-3 mr-1" />
                                                                            Retry
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}
