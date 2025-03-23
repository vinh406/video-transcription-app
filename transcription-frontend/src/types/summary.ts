export interface SummaryPoint {
    text: string;
    timestamp?: number;
}

export interface SummaryChapter {
    title: string;
    timestamp?: number;
    points: SummaryPoint[];
}

export interface SummaryData {
    overview: string;

    chapters?: SummaryChapter[];
    summary_points?: SummaryPoint[];
    success?: boolean;
    error?: string;
}
