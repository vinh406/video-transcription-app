import { useRef, useState, useEffect, forwardRef, ForwardedRef } from "react";

interface YouTubePlayerProps {
    videoId: string | null;
    onTimeUpdate?: (time: number) => void;
}

export const YouTubePlayer = forwardRef(function YouTubePlayer(
    { videoId, onTimeUpdate }: YouTubePlayerProps,
    ref: ForwardedRef<HTMLDivElement>
) {
    const playerRef = useRef<YT.Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isApiReady, setIsApiReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Load YouTube API
    useEffect(() => {
        // If script already exists, don't add it again
        if (window.YT) {
            setIsApiReady(true);
            return;
        }

        // Define callback for YouTube API
        const onYouTubeIframeAPIReady = () => {
            setIsApiReady(true);
        };

        // Add callback to window
        window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

        // Load YouTube API script
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        return () => {
            // Cleanup
            window.onYouTubeIframeAPIReady = null as unknown;
        };
    }, []);

    // Initialize YouTube player when API is ready
    useEffect(() => {
        if (!isApiReady || !containerRef.current || !videoId) return;

        // Create player
        playerRef.current = new YT.Player(containerRef.current, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 1,
                'rel': 0,
                'modestbranding': 1,
            },
            events: {
                'onStateChange': (event) => {
                    setIsPlaying(event.data === YT.PlayerState.PLAYING);
                }
            }
        });

        // Set up time tracking for transcript sync
        const timeUpdateInterval = setInterval(() => {
            if (playerRef.current && isPlaying && onTimeUpdate) {
                const currentTime = playerRef.current.getCurrentTime();
                onTimeUpdate(currentTime);
            }
        }, 100);

        return () => {
            clearInterval(timeUpdateInterval);
            if (playerRef.current) {
                playerRef.current.destroy();
            }
        };
    }, [isApiReady, videoId, onTimeUpdate, isPlaying]);

    return <div ref={(element) => {
        // Handle both the local ref and the forwarded ref
        containerRef.current = element;
        if (typeof ref === 'function') {
            ref(element);
        } else if (ref) {
            ref.current = element;
        }
    }} className="w-full h-full" />;
});