import { useRef, useEffect, useState, forwardRef, ForwardedRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Maximize,
} from "lucide-react";

interface VideoPlayerProps {
    src: string | null;
    onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer = forwardRef(function VideoPlayer(
    { src, onTimeUpdate }: VideoPlayerProps,
    ref: ForwardedRef<HTMLVideoElement>
) {
    const internalVideoRef = useRef<HTMLVideoElement>(null);
    const videoRef = (ref ||
        internalVideoRef) as React.MutableRefObject<HTMLVideoElement | null>;

    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [, setIsFullscreen] = useState(false);

    // Handle play/pause toggle
    const togglePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Skip backward 10 seconds
    const skipBackward = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(
                0,
                videoRef.current.currentTime - 10
            );
        }
    };

    // Skip forward 10 seconds
    const skipForward = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.min(
                duration,
                videoRef.current.currentTime + 10
            );
        }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch((err) => {
                console.error(
                    `Error attempting to enable fullscreen: ${err.message}`
                );
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Update time display
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            onTimeUpdate?.(video.currentTime);
        };

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        const handlePlay = () => {
            setIsPlaying(true);
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("ended", handleEnded);
        video.addEventListener("play", handlePlay);
        video.addEventListener("pause", handlePause);

        return () => {
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("ended", handleEnded);
            video.removeEventListener("play", handlePlay);
            video.removeEventListener("pause", handlePause);
        };
    }, [onTimeUpdate, videoRef]);

    // Monitor fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange
            );
        };
    }, []);

    // Format time in MM:SS format
    const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    // Handle volume change
    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    // Handle seeking
    const handleSeek = (value: number[]) => {
        const newTime = value[0];
        setCurrentTime(newTime);
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
        }
    };

    // Toggle mute
    const toggleMute = () => {
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.volume = volume || 1;
                setIsMuted(false);
            } else {
                videoRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full group"
            onMouseEnter={() => setIsControlsVisible(true)}
            onMouseLeave={() => isPlaying && setIsControlsVisible(false)}
        >
            <video
                ref={videoRef}
                src={src || undefined}
                className="w-full h-full object-contain bg-black"
                onClick={togglePlayPause}
                onDoubleClick={toggleFullscreen}
            />

            {/* Video controls overlay */}
            <div
                className={`absolute bottom-0 left-0 right-0 bg-black/70 p-4 transition-opacity ${
                    isControlsVisible ? "opacity-100" : "opacity-0"
                }`}
            >
                {/* Progress bar */}
                <Slider
                    value={[currentTime]}
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="w-full"
                />

                <div className="flex justify-between mt-2">
                    {/* Left controls: play/pause, skip buttons, time */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white"
                            onClick={togglePlayPause}
                        >
                            {isPlaying ? (
                                <Pause size={18} />
                            ) : (
                                <Play size={18} />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white"
                            onClick={skipBackward}
                        >
                            <SkipBack size={18} />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white"
                            onClick={skipForward}
                        >
                            <SkipForward size={18} />
                        </Button>

                        <span className="text-xs text-white">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Right controls: volume, fullscreen */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white"
                            onClick={toggleMute}
                        >
                            {isMuted ? (
                                <VolumeX size={18} />
                            ) : (
                                <Volume2 size={18} />
                            )}
                        </Button>

                        <Slider
                            value={[isMuted ? 0 : volume]}
                            min={0}
                            max={1}
                            step={0.01}
                            onValueChange={handleVolumeChange}
                            className="w-20"
                        />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white"
                            onClick={toggleFullscreen}
                        >
                            <Maximize size={18} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});