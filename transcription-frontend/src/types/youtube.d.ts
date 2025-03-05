// Type definitions for YouTube IFrame Player API
interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady
}

declare namespace YT {
    interface PlayerEvent {
        target: Player;
        data: unknown;
    }

    interface PlayerOptions {
        width?: string | number;
        height?: string | number;
        videoId?: string;
        playerVars?: {
            [key: string]: unknown;
        };
        events?: {
            onReady?: (event: PlayerEvent) => void;
            onStateChange?: (event: PlayerEvent) => void;
            onPlaybackQualityChange?: (event: PlayerEvent) => void;
            onPlaybackRateChange?: (event: PlayerEvent) => void;
            onError?: (event: PlayerEvent) => void;
            onApiChange?: (event: PlayerEvent) => void;
        };
    }

    enum PlayerState {
        UNSTARTED = -1,
        ENDED = 0,
        PLAYING = 1,
        PAUSED = 2,
        BUFFERING = 3,
        CUED = 5,
    }

    class Player {
        constructor(element: HTMLElement | string, options: PlayerOptions);
        playVideo(): void;
        pauseVideo(): void;
        stopVideo(): void;
        seekTo(seconds: number, allowSeekAhead?: boolean): void;
        getCurrentTime(): number;
        getDuration(): number;
        getVideoUrl(): string;
        getVideoEmbedCode(): string;
        getIframe(): HTMLIFrameElement;
        destroy(): void;
    }
}
