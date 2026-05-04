import { Mode, RunOutput } from "@/types/production";

export function generateMockOutput({
    mode,
    topic,
    chapter,
}: {
    mode: Mode;
    topic: string;
    chapter: string;
}): RunOutput {
    const safeTopic = topic.trim() || "Untitled Topic";
    const safeChapter = chapter.trim() || "Untitled Chapter";

    return {
        prompt: `RUN EXECUTION SYSTEM

Mode: ${mode}
Chapter: ${safeChapter}
Topic: ${safeTopic}`,

        blueprint: `VISUAL BLUEPRINT

Mode: ${mode}
Chapter: ${safeChapter}
Topic: ${safeTopic}`,

        overlay: `TEXT OVERLAY

${safeTopic}
${safeChapter}`,

        notes: `SYSTEM NOTES

Mode: ${mode}
Ready for API connection`,
    };
}