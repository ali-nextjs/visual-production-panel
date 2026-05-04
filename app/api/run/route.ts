import { NextResponse } from "next/server";
import OpenAI from "openai";

type Interpretation = {
    visualType?: "comparison" | "anatomy" | "process" | "diagram" | "concept" | string;
    layout?: "split" | "flow" | "central" | "grid" | string;
    focus?: string;
    complexity?: "low" | "medium" | "high" | string;
    notes?: string;
};

type CanvaContent = {
    header?: string;
    mainLeft?: string;
    mainRight?: string;
    step1?: string;
    step2?: string;
    step3?: string;
    center?: string;
    topLeft?: string;
    topRight?: string;
    bottomLeft?: string;
    bottomRight?: string;
    labels?: string[];
    notes?: string[];
};

type Variant = "standard" | "ebook" | "infographic";
type Layout = "split" | "flow" | "central" | "grid";

async function interpretInput(
    openai: OpenAI,
    params: { topic?: string; goal?: string; context?: string }
): Promise<Interpretation> {
    const prompt = `
Return ONLY valid JSON:
{
  "visualType": "comparison | anatomy | process | diagram | concept",
  "layout": "split | flow | central | grid",
  "focus": "short phrase",
  "complexity": "low | medium | high",
  "notes": "short phrase"
}

Rules:
- comparison usually prefers split
- process usually prefers flow
- concept usually prefers central
- anatomy can prefer central or grid
- diagram can prefer grid or flow

Topic: ${params.topic || ""}
Goal: ${params.goal || ""}
Context: ${params.context || ""}
`;

    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
    });

    try {
        return JSON.parse(res.choices[0].message.content || "{}");
    } catch {
        return {
            visualType: "concept",
            layout: "central",
            focus: "general explanation",
            complexity: "medium",
            notes: "fallback interpretation",
        };
    }
}

function normalizeBaseLayout(interpretation: Interpretation): Layout {
    const visualType = (interpretation.visualType || "").toLowerCase();
    const layout = (interpretation.layout || "").toLowerCase();

    if (layout === "split" || layout === "flow" || layout === "central" || layout === "grid") {
        return layout;
    }
    if (visualType === "comparison") return "split";
    if (visualType === "process") return "flow";
    if (visualType === "anatomy") return "central";
    if (visualType === "diagram") return "grid";
    return "central";
}

function hardVariantLayout(baseLayout: Layout, variant: Variant): Layout {
    if (variant === "ebook") return "central";
    if (variant === "infographic") return baseLayout === "flow" ? "flow" : "grid";
    return baseLayout;
}

async function extractBaseCanvaContent(
    openai: OpenAI,
    params: {
        topic?: string;
        goal?: string;
        context?: string;
        visualStyle?: string;
        outputDepth?: string;
        interpretation: Interpretation;
    }
): Promise<CanvaContent> {
    const baseLayout = normalizeBaseLayout(params.interpretation);

    const prompt = `
You are extracting meaningful Canva content for an educational visual.

Return ONLY valid JSON.

If base layout = split:
{
  "header": "short paragraph",
  "mainLeft": "short paragraph",
  "mainRight": "short paragraph",
  "labels": ["label 1", "label 2", "label 3"],
  "notes": ["note 1", "note 2", "note 3"]
}

If base layout = flow:
{
  "header": "short paragraph",
  "step1": "short paragraph",
  "step2": "short paragraph",
  "step3": "short paragraph",
  "labels": ["label 1", "label 2", "label 3"],
  "notes": ["note 1", "note 2", "note 3"]
}

If base layout = central:
{
  "header": "short paragraph",
  "center": "short paragraph",
  "labels": ["label 1", "label 2", "label 3"],
  "notes": ["note 1", "note 2", "note 3"]
}

If base layout = grid:
{
  "header": "short paragraph",
  "topLeft": "short paragraph",
  "topRight": "short paragraph",
  "bottomLeft": "short paragraph",
  "bottomRight": "short paragraph",
  "labels": ["label 1", "label 2", "label 3"],
  "notes": ["note 1", "note 2", "note 3"]
}

Topic: ${params.topic || ""}
Goal: ${params.goal || ""}
Context: ${params.context || ""}
Visual Style: ${params.visualStyle || ""}
Output Depth: ${params.outputDepth || ""}
Visual Type: ${params.interpretation.visualType || ""}
Base Layout: ${baseLayout}
Focus: ${params.interpretation.focus || ""}

Rules:
- avoid generic filler text
- use content-aware educational phrasing
- labels must be short
- notes must be practical
`;

    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
    });

    try {
        return JSON.parse(res.choices[0].message.content || "{}");
    } catch {
        return {
            header: params.goal || "Clear educational overview",
            mainLeft: params.topic || "Primary concept",
            mainRight: params.context || "Supporting explanation",
            step1: "Step 1 overview",
            step2: "Step 2 progression",
            step3: "Step 3 outcome",
            center: params.context || params.topic || "Central explanation",
            topLeft: "Top-left concept",
            topRight: "Top-right concept",
            bottomLeft: "Bottom-left concept",
            bottomRight: "Bottom-right concept",
            labels: ["Main idea", "Visual focus", "Key point"],
            notes: ["Readable layout", "Balanced spacing", "Clear hierarchy"],
        };
    }
}

function ensureArray(values: string[] | undefined, fallback: string[]) {
    const cleaned = (values || []).map((v) => (v || "").trim()).filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    while (unique.length < 3) unique.push(fallback[unique.length] || `Item ${unique.length + 1}`);
    return unique.slice(0, 3);
}

function ensureText(value: string | undefined, fallback: string) {
    const clean = (value || "").trim();
    return clean.length >= 8 ? clean : fallback;
}

function variantLabels(variant: Variant, interpretation: Interpretation) {
    if (variant === "ebook") return [interpretation.focus || "Key idea", "Reading focus", "Core concept"];
    if (variant === "infographic") return [interpretation.visualType || "Main point", "Quick scan", "Takeaway"];
    return [interpretation.visualType || "Main idea", interpretation.focus || "Visual focus", "Key point"];
}

function variantNotes(variant: Variant, layout: Layout) {
    if (variant === "ebook") return ["Prefer readability", "Longer reading flow", `Layout: ${layout}`];
    if (variant === "infographic") return ["Fast scanning", "Short content blocks", `Layout: ${layout}`];
    return [`Layout: ${layout}`, "Balanced spacing", "Clear hierarchy"];
}

function hardenContentForLayout(content: CanvaContent, layout: Layout, topic: string, context: string): CanvaContent {
    if (layout === "central") {
        return {
            ...content,
            center: ensureText(content.center || content.mainLeft || content.topLeft || content.step1, context || topic || "Central explanation"),
        };
    }
    if (layout === "split") {
        return {
            ...content,
            mainLeft: ensureText(content.mainLeft || content.topLeft || content.center || content.step1, topic || "Primary concept"),
            mainRight: ensureText(content.mainRight || content.topRight || content.bottomLeft || content.step2, context || "Supporting explanation"),
        };
    }
    if (layout === "flow") {
        return {
            ...content,
            step1: ensureText(content.step1 || content.mainLeft || content.center, "Starting point"),
            step2: ensureText(content.step2 || content.mainRight || content.topLeft, "Middle progression"),
            step3: ensureText(content.step3 || content.bottomRight || content.topRight, "Final outcome"),
        };
    }
    return {
        ...content,
        topLeft: ensureText(content.topLeft || content.mainLeft || content.center, "Top-left concept"),
        topRight: ensureText(content.topRight || content.mainRight || content.step1, "Top-right concept"),
        bottomLeft: ensureText(content.bottomLeft || content.step2 || content.center, "Bottom-left concept"),
        bottomRight: ensureText(content.bottomRight || content.step3 || content.mainRight, "Bottom-right concept"),
    };
}

function rewriteForVariant(
    variant: Variant,
    content: CanvaContent,
    layout: Layout,
    topic: string,
    goal: string,
    context: string,
    interpretation: Interpretation
): CanvaContent {
    const hardened = hardenContentForLayout(content, layout, topic, context);

    if (variant === "ebook") {
        return {
            ...hardened,
            header: ensureText(hardened.header, `Readable chapter-style explanation of ${topic}.`),
            center:
                layout === "central"
                    ? ensureText(
                        hardened.center,
                        `${topic} is explained in a calmer, more descriptive reading format focused on ${interpretation.focus || "understanding"}.`
                    )
                    : hardened.center,
            labels: ensureArray(hardened.labels, variantLabels(variant, interpretation)),
            notes: ensureArray(hardened.notes, variantNotes(variant, layout)),
        };
    }

    if (variant === "infographic") {
        return {
            ...hardened,
            header: ensureText(hardened.header, `${topic}: quick infographic summary`),
            labels: ensureArray(hardened.labels, variantLabels(variant, interpretation)),
            notes: ensureArray(hardened.notes, variantNotes(variant, layout)),
        };
    }

    return {
        ...hardened,
        header: ensureText(hardened.header, goal || `Clear overview of ${topic}`),
        labels: ensureArray(hardened.labels, variantLabels(variant, interpretation)),
        notes: ensureArray(hardened.notes, variantNotes(variant, layout)),
    };
}

function buildMainBlock(layout: Layout, content: CanvaContent) {
    if (layout === "split") return `Left: ${content.mainLeft}\nRight: ${content.mainRight}`;
    if (layout === "flow") return `Step 1: ${content.step1}\nStep 2: ${content.step2}\nStep 3: ${content.step3}`;
    if (layout === "grid") return `Top Left: ${content.topLeft}\nTop Right: ${content.topRight}\nBottom Left: ${content.bottomLeft}\nBottom Right: ${content.bottomRight}`;
    return `Center: ${content.center}`;
}

function buildVariantBlock(params: {
    variant: Variant;
    topic: string;
    chapter: string;
    interpretation: Interpretation;
    content: CanvaContent;
    goal: string;
    context: string;
}) {
    const baseLayout = normalizeBaseLayout(params.interpretation);
    const layout = hardVariantLayout(baseLayout, params.variant);
    const content = rewriteForVariant(params.variant, params.content, layout, params.topic, params.goal, params.context, params.interpretation);

    const labels = ensureArray(content.labels, variantLabels(params.variant, params.interpretation));
    const notes = ensureArray(content.notes, variantNotes(params.variant, layout));

    const titleMap = {
        standard: "CANVA STANDARD",
        ebook: "CANVA EBOOK PAGE",
        infographic: "CANVA INFOGRAPHIC PAGE",
    } as const;

    const footerMap = {
        standard: "A.G | Visual Production System",
        ebook: "Chapter layout | A.G",
        infographic: "Infographic layout | A.G",
    } as const;

    return `${titleMap[params.variant]}
Page Title:
${params.topic}

Subtitle:
${params.chapter}

Header Block:
${content.header}

Main Block:
${buildMainBlock(layout, content)}

Side Labels:
- ${labels[0]}
- ${labels[1]}
- ${labels[2]}

Footer:
${footerMap[params.variant]}

Design Notes:
- Layout: ${layout}
- Focus: ${params.interpretation.focus || "clear explanation"}
- ${notes[0]}`;
}

function buildCanvaOutput(params: {
    topic?: string;
    chapter?: string;
    interpretation?: Interpretation;
    content?: CanvaContent;
    goal?: string;
    context?: string;
}) {
    const topic = params.topic?.trim() || "Untitled Topic";
    const chapter = params.chapter?.trim() || "Untitled Chapter";
    const interpretation = params.interpretation || {};
    const content = params.content || {};
    const goal = params.goal?.trim() || `Clear overview of ${topic}`;
    const context = params.context?.trim() || `Structured explanation of ${topic}`;

    return [
        buildVariantBlock({ variant: "standard", topic, chapter, interpretation, content, goal, context }),
        buildVariantBlock({ variant: "ebook", topic, chapter, interpretation, content, goal, context }),
        buildVariantBlock({ variant: "infographic", topic, chapter, interpretation, content, goal, context }),
    ].join("\n\n----------------------------------------\n\n");
}

function buildFallbackSections(body: any, interpretation: Interpretation, canva: string) {
    return {
        prompt: `### Prompt
Create a ${interpretation.visualType || "concept"} visual for "${body.topic || "Untitled Topic"}" using a ${normalizeBaseLayout(interpretation)} layout.`,
        blueprint: `### Blueprint
Main subject: ${body.topic || "Untitled Topic"}
Layout: ${normalizeBaseLayout(interpretation)}
Focus: ${interpretation.focus || "clear explanation"}
Complexity: ${interpretation.complexity || "medium"}`,
        overlay: `### Overlay
Title: ${body.topic || "Untitled Topic"}
Subtitle: ${body.chapter || "Untitled Chapter"}
Labels:
- ${interpretation.visualType || "Concept"}
- ${normalizeBaseLayout(interpretation)}
- ${interpretation.focus || "Focus"}`,
        notes: `### Notes
Goal: ${body.goal || "Clear visual output"}
Depth: ${body.outputDepth || "medium"}
Style: ${body.visualStyle || "clean educational visual"}`,
        canva,
    };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { topic, goal, context, chapter, visualStyle, outputDepth } = body;

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const interpretation = await interpretInput(openai, { topic, goal, context });
        const baseContent = await extractBaseCanvaContent(openai, {
            topic,
            goal,
            context,
            visualStyle,
            outputDepth,
            interpretation,
        });

        const canva = buildCanvaOutput({
            topic,
            chapter,
            interpretation,
            content: baseContent,
            goal,
            context,
        });

        const systemPrompt = `
You are a professional visual production system.

Use this interpretation:
${JSON.stringify(interpretation, null, 2)}

Return text with these exact section headings:
### Prompt
### Blueprint
### Overlay
### Notes

Keep the output concise, structured, and production-ready.
Do NOT generate Canva here.
`;

        const userPrompt = `
Topic: ${topic || ""}
Chapter: ${chapter || ""}
Goal: ${goal || ""}
Context: ${context || ""}
Style: ${visualStyle || ""}
Depth: ${outputDepth || ""}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        });

        const text = completion.choices[0].message.content || "";

        const sections = {
            prompt: "",
            blueprint: "",
            overlay: "",
            notes: "",
            canva,
        };

        const parts = text.split("###");
        parts.forEach((part) => {
            const p = part.toLowerCase();
            if (p.includes("prompt")) sections.prompt = `### ${part.trim()}`;
            else if (p.includes("blueprint")) sections.blueprint = `### ${part.trim()}`;
            else if (p.includes("overlay")) sections.overlay = `### ${part.trim()}`;
            else if (p.includes("notes")) sections.notes = `### ${part.trim()}`;
        });

        if (!sections.prompt || !sections.blueprint || !sections.overlay || !sections.notes) {
            return NextResponse.json({
                success: true,
                data: buildFallbackSections(body, interpretation, canva),
                source: "fallback",
                validationStatus: "fallback",
                interpretation,
            });
        }

        return NextResponse.json({
            success: true,
            data: sections,
            source: "ai",
            validationStatus: "ai",
            interpretation,
        });
    } catch (error: any) {
        const interpretation: Interpretation = {
            visualType: "concept",
            layout: "central",
            focus: "general explanation",
            complexity: "medium",
            notes: "fallback interpretation",
        };

        const canva = buildCanvaOutput({
            topic: "Fallback Topic",
            chapter: "Fallback Chapter",
            interpretation,
            content: {
                header: "Clear educational overview.",
                center: "Primary concept explanation",
                labels: ["Main idea", "Visual focus", "Key point"],
                notes: ["Readable layout", "Balanced spacing", "Clear hierarchy"],
            },
            goal: "Clear overview",
            context: "Structured explanation",
        });

        return NextResponse.json({
            success: true,
            data: buildFallbackSections({}, interpretation, canva),
            source: "fallback",
            error: error.message,
            validationStatus: "fallback",
            interpretation,
        });
    }
}
