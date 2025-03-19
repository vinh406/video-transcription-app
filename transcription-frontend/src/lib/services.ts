export enum Service {
    whisperx = "WhisperX",
    google = "Google Gemini",
    elevenlabs = "ElevenLabs",
}

export const getServiceName = (code: string): string => {
    return code in Service ? Service[code as keyof typeof Service] : code;
};

export const serviceOptions = Object.entries(Service).map(([code, name]) => ({
    value: code,
    label: name,
}));
