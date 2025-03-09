interface SummaryPoint {
    text: string;
    timestamp?: number;
}

export interface SummaryData {
    overview?: string;
    summary_points?: SummaryPoint[];
}
