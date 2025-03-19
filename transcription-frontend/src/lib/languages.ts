export enum Language {
    auto = "Auto-detect",
    en = "English",
    fr = "French",
    de = "German",
    es = "Spanish",
    it = "Italian",
    vi = "Vietnamese",
}

export const getLanguageName = (code: string): string => {
    return code in Language ? Language[code as keyof typeof Language] : code;
};

export const languageOptions = Object.entries(Language).map(([code, name]) => ({
    value: code,
    label: name,
}));
