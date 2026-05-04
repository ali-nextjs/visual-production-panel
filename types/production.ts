export type Mode = "single" | "chapter" | "book";

export type OutputTab = "prompt" | "blueprint" | "overlay" | "notes" | "canva";

export type RunOutput = {
    prompt: string;
    blueprint: string;
    overlay: string;
    notes: string;
    canva: string;
};

export type InputConfig = {
    topic: string;
    chapter: string;
    goal: string;
    context: string;
    visualStyle: string;
    outputDepth: "low" | "medium" | "high";
};
