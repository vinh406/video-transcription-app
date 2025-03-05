export interface Segment {
    start: number;
    end: number;
    text: string;
    speaker: string;
    words?: Array<{
        start: number;
        end: number;
        word: string;
        speaker: string;
        score?: number;
    }>;
}
