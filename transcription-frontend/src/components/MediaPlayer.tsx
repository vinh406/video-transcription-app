import {
    forwardRef,
    useRef,
    useEffect,
    useImperativeHandle,
    useState,
} from "react";
import ReactPlayer from "react-player";
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
import { VideoVolumeSlider } from "@/components/ui/VideoVolumeSlider";

export interface MediaPlayerHandle {
    seekTo: (time: number) => void;
}

interface MediaPlayerProps {
    src: string;
    type?: "audio" | "video" | "youtube";
    onTimeUpdate?: (time: number) => void;
}

export const MediaPlayer = forwardRef<MediaPlayerHandle, MediaPlayerProps>(
    function MediaPlayer({ src, type = "video", onTimeUpdate }, ref) {
        const playerRef = useRef<ReactPlayer>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [duration, setDuration] = useState(0);
        const [currentTime, setCurrentTime] = useState(0);
        const [volume, setVolume] = useState(1);
        const [isMuted, setIsMuted] = useState(false);
        const [isControlsVisible, setIsControlsVisible] = useState(true);

        // Expose methods via ref
        useImperativeHandle(ref, () => ({
            seekTo: (time: number) => {
                if (playerRef.current) {
                    playerRef.current.seekTo(time, "seconds");
                }
            },
        }));

        // Time update tracking
        useEffect(() => {
            if (!playerRef.current || !onTimeUpdate) return;

            const interval = setInterval(() => {
                if (playerRef.current) {
                    const currentTime = playerRef.current.getCurrentTime();
                    setCurrentTime(currentTime);
                    onTimeUpdate(currentTime);
                }
            }, 100);

            return () => clearInterval(interval);
        }, [onTimeUpdate]);

        // Media control functions
        const togglePlayPause = () => {
            setIsPlaying(!isPlaying);
        };

        const skipBackward = () => {
            if (playerRef.current) {
                const newTime = Math.max(0, currentTime - 10);
                playerRef.current.seekTo(newTime, "seconds");
            }
        };

        const skipForward = () => {
            if (playerRef.current) {
                const newTime = Math.min(duration, currentTime + 10);
                playerRef.current.seekTo(newTime, "seconds");
            }
        };

        const handleSeek = (value: number[]) => {
            const newTime = value[0];
            setCurrentTime(newTime);
            if (playerRef.current) {
                playerRef.current.seekTo(newTime, "seconds");
            }
        };

        const toggleMute = () => {
            setIsMuted(!isMuted);
        };

        const handleVolumeChange = (value: number[]) => {
            const newVolume = value[0];
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        };

        const toggleFullscreen = () => {
            if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        };

        // Format time in MM:SS format
        const formatTime = (time: number): string => {
            const minutes = Math.floor(time / 60);
            const seconds = Math.floor(time % 60);
            return `${minutes}:${seconds.toString().padStart(2, "0")}`;
        };

        // Determine correct URL format for YouTube
        let url = src;
        if (type === "youtube" && !src.startsWith("http")) {
            url = `https://www.youtube.com/watch?v=${src}`;
        }

        // Audio player UI (similar to original AudioPlayer)
        if (type === "audio") {
            return (
                <div className="w-full bg-background text-foreground p-4">
                    {/* Hidden ReactPlayer for functionality */}
                    <div className="hidden">
                        <ReactPlayer
                            ref={playerRef}
                            url={url}
                            playing={isPlaying}
                            volume={isMuted ? 0 : volume}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onDuration={(dur) => setDuration(dur)}
                            config={{
                                file: {
                                    forceAudio: true,
                                },
                            }}
                        />
                    </div>

                    {/* Original AudioPlayer UI */}
                    <div className="flex items-center gap-4">
                        {/* Left side - playback controls */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={skipBackward}
                                title="Skip 10s backward"
                            >
                                <SkipBack size={20} />
                            </Button>

                            <Button
                                variant="default"
                                size="icon"
                                className="rounded-full w-10 h-10 bg-primary text-primary-foreground"
                                onClick={togglePlayPause}
                            >
                                {isPlaying ? (
                                    <Pause size={20} />
                                ) : (
                                    <Play size={20} />
                                )}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={skipForward}
                                title="Skip 10s forward"
                            >
                                <SkipForward size={20} />
                            </Button>
                        </div>

                        {/* Middle - seekbar and time display */}
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16 text-right">
                                {formatTime(currentTime)}
                            </span>

                            <Slider
                                value={[currentTime]}
                                min={0}
                                max={duration || 100}
                                step={0.1}
                                onValueChange={handleSeek}
                                className="flex-1"
                            />

                            <span className="text-xs text-muted-foreground w-16">
                                {formatTime(duration)}
                            </span>
                        </div>

                        {/* Right side - volume controls */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleMute}
                            >
                                {isMuted ? (
                                    <VolumeX size={20} />
                                ) : (
                                    <Volume2 size={20} />
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
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                ref={containerRef}
                className="w-full h-full relative"
                onMouseEnter={() => setIsControlsVisible(true)}
                onMouseLeave={() => isPlaying && setIsControlsVisible(false)}
            >
                {/* Add a click handler overlay that covers the video but not the controls */}
                {type !== "youtube" && (
                    <div
                        className="absolute inset-0 z-1"
                        onClick={togglePlayPause}
                    />
                )}

                <ReactPlayer
                    ref={playerRef}
                    url={url}
                    width="100%"
                    height="100%"
                    playing={isPlaying}
                    volume={isMuted ? 0 : volume}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onDuration={(dur) => setDuration(dur)}
                    controls={type === "youtube"}
                />

                {/* Video controls */}
                {type !== "youtube" && (
                    <div
                        className={`z-2 absolute bottom-0 left-0 right-0 bg-black/70 p-4 transition-opacity ${
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
                                    {formatTime(currentTime)} /
                                    {formatTime(duration)}
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

                                <VideoVolumeSlider
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
                )}
            </div>
        );
    }
);
