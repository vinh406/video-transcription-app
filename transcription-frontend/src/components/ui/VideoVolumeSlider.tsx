// Add this to MediaPlayer.tsx or create a new file VideoVolumeSlider.tsx
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

// Custom white-themed slider for video controls
export function VideoVolumeSlider({
    className,
    value,
    onValueChange,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
    value?: number[];
    onValueChange?: (value: number[]) => void;
}) {
    const _values = React.useMemo(
        () => (Array.isArray(value) ? value : [0, 1]),
        [value]
    );

    return (
        <SliderPrimitive.Root
            data-slot="slider"
            value={value}
            onValueChange={onValueChange}
            className={cn(
                "relative flex w-full touch-none items-center select-none",
                className
            )}
            {...props}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className="bg-white/30 relative grow overflow-hidden rounded-full h-1.5 w-full"
            >
                <SliderPrimitive.Range
                    data-slot="slider-range"
                    className="bg-white absolute h-full"
                />
            </SliderPrimitive.Track>
            {Array.from({ length: _values.length }, (_, index) => (
                <SliderPrimitive.Thumb
                    data-slot="slider-thumb"
                    key={index}
                    className="bg-zinc-400 block size-3 shrink-0 rounded-full shadow-sm transition-[color,box-shadow] hover:ring-2 hover:ring-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-hidden"
                />
            ))}
        </SliderPrimitive.Root>
    );
}
