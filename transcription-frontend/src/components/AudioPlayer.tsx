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
} from "lucide-react";

interface AudioPlayerProps {
    src: string | null;
    onTimeUpdate?: (time: number) => void;
}

export const AudioPlayer = forwardRef(function AudioPlayer(
    { src, onTimeUpdate }: AudioPlayerProps,
    ref: ForwardedRef<HTMLAudioElement>
) {
    const internalAudioRef = useRef<HTMLAudioElement>(null);
    const audioRef = (ref ||
        internalAudioRef) as React.MutableRefObject<HTMLAudioElement | null>;

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    // Rest of your component code remains the same, just use audioRef instead of the old ref

    // Handle play/pause toggle
    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Skip backward 10 seconds
    const skipBackward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(
                0,
                audioRef.current.currentTime - 10
            );
        }
    };

    // Skip forward 10 seconds
    const skipForward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(
                duration,
                audioRef.current.currentTime + 10
            );
        }
    };

    // Update time display
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            onTimeUpdate?.(audio.currentTime);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("ended", handleEnded);
        };
    }, [audioRef, onTimeUpdate]);

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
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    // Handle seeking
    const handleSeek = (value: number[]) => {
        const newTime = value[0];
        setCurrentTime(newTime);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    // Toggle mute
    const toggleMute = () => {
        if (audioRef.current) {
            if (isMuted) {
                audioRef.current.volume = volume || 1;
                setIsMuted(false);
            } else {
                audioRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    return (
        <div className="w-full bg-background text-foreground p-4">
            <audio ref={audioRef} src={src || undefined} className="hidden" />

            {/* All controls on single line */}
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
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
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
                    <Button variant="ghost" size="icon" onClick={toggleMute}>
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
});
