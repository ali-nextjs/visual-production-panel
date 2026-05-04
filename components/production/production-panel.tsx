"use client";

// PATCH-27.1
import { useMemo, useEffect, useState, useRef } from "react";
import { Mode } from "@/types/production";

// === PATCH:HELPERS ===
function getPresetIntentAdvisory(args: {
    intent: string;
    preset: string;
}) {
    const preset = (args.preset || "").toLowerCase();
    const intent = (args.intent || "generic").toLowerCase();

    if (!preset) {
        return {
            level: "neutral" as const,
            message: "No preset selected.",
        };
    }

    if (intent === "comparison" && preset === "quick") {
        return {
            level: "hint" as const,
            message: "Pro preset may handle comparisons better.",
        };
    }

    if (intent === "process" && preset === "quick") {
        return {
            level: "hint" as const,
            message: "Pro preset recommended for step-by-step visuals.",
        };
    }

    if (intent === "diagnosis" && preset !== "pro") {
        return {
            level: "hint" as const,
            message: "Diagnosis topics usually benefit from Pro preset.",
        };
    }

    return {
        level: "good" as const,
        message: "Preset looks suitable for detected intent.",
    };
}
// END 14
function detectIntentFromTopic(topic: string) {
    const t = (topic || "").toLowerCase();

    if (t.includes("vs") || t.includes("compare") || t.includes("comparison"))
        return "comparison";

    if (t.includes("how") || t.includes("process") || t.includes("flow"))
        return "process";

    if (t.includes("anatomy") || t.includes("structure"))
        return "anatomy";

    if (t.includes("diagnos") || t.includes("problem"))
        return "diagnosis";

    return "generic";
}

function checkIntentConsistency(args: {
    topic: string;
    goal: string;
    context: string;
    preset: string;
}) {
    const intent = detectIntentFromTopic(args.topic);

    const g = (args.goal || "").toLowerCase();
    const c = (args.context || "").toLowerCase();

    let level: "good" | "warning" | "neutral" = "good";
    let message = "Intent alignment looks consistent.";

    if (intent === "comparison" && !g.includes("compar")) {
        level = "warning";
        message = "Topic suggests comparison but goal does not.";
    }

    if (intent === "process" && !g.includes("step")) {
        level = "warning";
        message = "Process-like topic but goal is not step-oriented.";
    }

    if (intent === "diagnosis" && !c.includes("diagnos")) {
        level = "warning";
        message = "Diagnosis topic but context may be missing.";
    }

    if (!args.goal && !args.context) {
        level = "neutral";
        message = "Goal and context not set — intent check limited.";
    }

    return {
        intent,
        level,
        message,
    };
}
// end patch 13
function normalizeInput(value: string) {
    return (value || "").trim();
}

function wordCount(value: string) {
    return normalizeInput(value).split(/\s+/).filter(Boolean).length;
}

function getTopicSignal(topic: string) {
    const t = normalizeInput(topic);
    if (!t) return "weak";
    if (t.length < 12) return "weak";
    if (t.length < 32) return "medium";
    return "strong";
}

function getSourceSignal(sourceText: string) {
    const count = wordCount(sourceText);
    if (count === 0) return "empty";
    if (count < 40) return "light";
    return "strong";
}

function getContentShape(topic: string, chapter: string, sourceText: string) {
    const topicCount = wordCount(topic);
    const chapterCount = wordCount(chapter);
    const sourceCount = wordCount(sourceText);

    if (sourceCount >= 80) return "chapter-like";
    if (sourceCount >= 20 || chapterCount >= 3) return "visual-brief";
    if (topicCount > 0) return "short-form";
    return "unknown";
}

function getContentSignalHint(args: {
    topic: string;
    chapter: string;
    sourceText: string;
}) {
    const topicSignal = getTopicSignal(args.topic);
    const sourceSignal = getSourceSignal(args.sourceText);
    const shape = getContentShape(args.topic, args.chapter, args.sourceText);

    if (topicSignal === "weak" && sourceSignal === "empty") {
        return "Add a clearer topic or paste a short source excerpt.";
    }

    if (topicSignal === "weak") {
        return "Make the topic more specific so suggestions and intent stay cleaner.";
    }

    if (sourceSignal === "empty" && shape !== "short-form") {
        return "Add a few source lines to strengthen production context.";
    }

    if (sourceSignal === "light") {
        return "Content is usable, but a bit more source text would improve stability.";
    }

    return "Content signal looks stable.";
}
function inferTopicBrain(topic: string) {
    const base = topic.trim().toLowerCase();

    if (!base) {
        return { intent: "comparison", layout: "split", complexity: "medium", reason: "default" };
    }

    if (base.includes(" vs ") || base.includes("comparison") || base.includes("difference")) {
        return { intent: "comparison", layout: "split", complexity: "medium", reason: "comparison detected" };
    }

    if (base.includes("anatomy") || base.includes("structure") || base.includes("parts")) {
        return { intent: "anatomy", layout: "central", complexity: "low", reason: "structure detected" };
    }

    if (base.includes("flow") || base.includes("process") || base.includes("cycle")) {
        return { intent: "process", layout: "flow", complexity: "medium", reason: "flow detected" };
    }

    return { intent: "concept", layout: "central", complexity: "medium", reason: "fallback" };
}
function inferPresetBrain(activePreset?: "quick" | "pro" | "canva" | null) {
    if (activePreset === "quick") {
        return {
            intent: "simple explanation",
            layout: "single",
            complexity: "low",
            reason: "quick preset favors speed and simplicity",
        };
    }

    if (activePreset === "pro") {
        return {
            intent: "detailed explanation",
            layout: "structured",
            complexity: "high",
            reason: "pro preset favors detail and production depth",
        };
    }


    if (activePreset === "canva") {
        return {
            intent: "visual production",
            layout: "block-based",
            complexity: "medium",
            reason: "canva preset favors structured visual blocks",
        };
    }

    return {
        intent: "general",
        layout: "flexible",
        complexity: "medium",
        reason: "no preset selected",
    };
}
type PresetKey = "quick" | "pro" | "canva";
type InputTab = "preset" | "content" | "intent" | "style" | "quality";

type Props = {
    mode: Mode;
    topic: string;
    chapter: string;
    goal: string;
    context: string;
    visualStyle: string;
    outputDepth: string;
    activePreset?: PresetKey | null;
    locks: {
        style: boolean;
        depth: boolean;
    };
    summary: {
        mode: Mode;
        topic: string;
        chapter: string;
        goal: string;
        context: string;
        visualStyle: string;
        outputDepth: string;
        preset?: PresetKey | null;
    };
    canRun: boolean;
    isLoading: boolean;
    onModeChange: (v: Mode) => void;
    onTopicChange: (v: string) => void;
    onChapterChange: (v: string) => void;
    onGoalChange: (v: string) => void;
    onContextChange: (v: string) => void;
    onStyleChange: (v: string) => void;
    onDepthChange: (v: string) => void;
    onToggleLock: (key: "style" | "depth") => void;
    onApplyPreset: (preset: PresetKey) => void;
    onClearAutoLocks?: () => void;
    onRun: () => void;
};

function Box({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-gray-800/80 p-3.5 space-y-2.5 transition-colors hover:bg-gray-800/90 ring-1 ring-white/5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
            <div className="pb-2 border-b border-white/5">
                <div className="text-[13px] font-semibold tracking-[0.01em] text-white">{title}</div>
                {subtitle ? (
                    <div className="mt-1 text-[12px] text-gray-400/80 leading-5">{subtitle}</div>
                ) : null}
            </div>
            {children}
        </div>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-400">{label}</div>
                {hint ? <div className="text-[11px] text-gray-500">{hint}</div> : null}
            </div>
            {children}
        </div>
    );
}

function Tooltip({ text }: { text: string }) {
    return (
        <div className="group relative inline-flex">
            <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[11px] text-gray-200"
            >
                ?
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs leading-5 text-gray-200 shadow-xl group-hover:block">
                {text}
            </div>
        </div>
    );
}

function PresetCard({
    title,
    desc,
    active,
    onClick,
}: {
    title: string;
    desc: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full rounded-xl border p-4 text-left transition ${active
                ? "border-white bg-white text-black"
                : "border-gray-700 bg-gray-900 text-white hover:border-gray-500"
                }`}
        >
            <div className="text-sm font-semibold">{title}</div>
            <div
                className={`mt-2 text-xs leading-5 ${active ? "text-black/70" : "text-gray-400"
                    }`}
            >
                {desc}
            </div>
        </button>
    );
}

function WarningText({ text }: { text: string }) {
    if (!text) return null;
    return <div className="text-xs text-yellow-400">{text}</div>;
}

const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition focus:border-gray-500";

function normalizeSpaces(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function titleCaseWords(value: string) {
    return value
        .split(" ")
        .map((word) => {
            if (!word) return word;
            const lower = word.toLowerCase();
            if (["vs", "and", "or", "of", "in", "on", "for", "to"].includes(lower)) {
                return lower;
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(" ");
}

function safeTypoFixTopic(value: string) {
    let v = normalizeSpaces(value);
    v = v
        .replace(/\brooot\b/gi, "root")
        .replace(/\broott\b/gi, "root")
        .replace(/\bhelth\b/gi, "health")
        .replace(/\bhealty\b/gi, "healthy")
        .replace(/\brot\s+rot\b/gi, "root rot")
        .replace(/\bhyrdoponic\b/gi, "hydroponic")
        .replace(/\bcomparision\b/gi, "comparison");
    return titleCaseWords(v);
}

function safeTypoFixChapter(value: string) {
    let v = normalizeSpaces(value);
    v = v
        .replace(/\bchaptr\b/gi, "chapter")
        .replace(/\bchpater\b/gi, "chapter")
        .replace(/\bchaper\b/gi, "chapter");
    return v.replace(/\bchapter\s+(\d+)\b/gi, (_, n) => `Chapter ${n}`);
}

function safeTypoFixGoal(value: string) {
    let v = normalizeSpaces(value);
    v = v
        .replace(/\bcomparision\b/gi, "comparison")
        .replace(/\bdiagonsis\b/gi, "diagnosis")
        .replace(/\bdiagnotic\b/gi, "diagnostic")
        .replace(/\bvisaul\b/gi, "visual")
        .replace(/\bunderstading\b/gi, "understanding");
    return v;
}

function buildSuggestions(topic: string) {
    const base = topic.trim().toLowerCase();

    if (!base) {
        return [
            "Root Health vs Root Rot",
            "Healthy Root Visual Anatomy",
            "Root Oxygenation in DWC",
            "Root Temperature Impact",
        ];
    }

    if (base.includes("root")) {
        return [
            "Root Health vs Root Rot",
            "Healthy Root Visual Anatomy",
            "Root Oxygenation in DWC",
            "Root Temperature Impact",
        ];
    }

    if (base.includes("leaf")) {
        return [
            "Healthy Leaf vs Damaged Leaf",
            "Leaf Deficiency Indicators",
            "Leaf Structure Overview",
            "Leaf Burn Diagnostic Visual",
        ];
    }

    if (base.includes("nutrient")) {
        return [
            "Nutrient Uptake Flow",
            "Macro vs Micro Nutrients",
            "Deficiency vs Toxicity Comparison",
            "Nutrient Solution Structure",
        ];
    }

    return [
        `${topic} Overview`,
        `${topic} Visual Anatomy`,
        `${topic} Comparison`,
        `${topic} Process Flow`,
    ];
}

function getTopicWarning(topic: string) {
    const t = topic.trim();
    if (!t) return "Topic is empty.";
    if (t.length < 5) return "Topic is too short.";
    if (t.split(" ").length < 2) return "Topic is broad. Add more detail.";
    return "";
}

function getGoalWarning(goal: string) {
    const g = goal.trim().toLowerCase();
    if (!g) return "Goal is empty.";
    if (g.length < 10) return "Goal needs more detail.";
    if (["learn", "good", "better", "visual", "image"].includes(g)) {
        return "Goal is too vague. Clarify the reader outcome.";
    }
    return "";
}

function getContextWarning(context: string) {
    const c = context.trim();
    if (!c) return "Context is empty.";
    if (c.length < 12) return "Context is too short.";
    return "";
}

function scoreInput(topic: string, goal: string, context: string) {
    let score = 0;
    if (topic.trim().length >= 5) score += 30;
    if (topic.trim().split(" ").length >= 2) score += 10;
    if (goal.trim().length >= 10) score += 25;
    if (goal.trim().split(" ").length >= 3) score += 10;
    if (context.trim().length >= 12) score += 15;
    if (context.trim().split(" ").length >= 4) score += 10;
    return Math.min(score, 100);
}

function improveGoal(goal: string, topic: string) {
    const clean = goal.trim();
    if (!clean) return `Visual explanation of ${topic || "the topic"} for quick understanding`;
    if (clean.length < 12) return `${clean} for clear visual understanding`;
    return clean;
}

function improveContext(context: string, topic: string) {
    const clean = context.trim();
    if (!clean) return `Educational book visual focused on ${topic || "the topic"}`;
    if (clean.length < 20) return `${clean} with clear educational structure`;
    return clean;
}

export function ProductionPanel(props: Props) {
    const [sourceText, setSourceText] = useState("");
    const [activeTab, setActiveTab] = useState<InputTab>("preset");

    // === PATCH:MEMO ===
    const intentConsistencyPreview = useMemo(() => {
        return checkIntentConsistency({
            topic: props.topic,
            goal: props.goal,
            context: props.context,
            preset: props.activePreset || "",
        });
    }, [props.topic, props.goal, props.context, props.activePreset]);

    const presetIntentAdvisory = useMemo(() => {
        const detectedIntent = detectIntentFromTopic(props.topic);

        return getPresetIntentAdvisory({
            intent: detectedIntent,
            preset: props.activePreset || "",
        });
    }, [props.topic, props.activePreset]);
    // PATCH 14
    // === PATCH:STEP17 ===
    const inputReadiness = useMemo(() => {
        if (!props.topic?.trim()) {
            return {
                level: "weak",
                message: "Topic is required.",
            };
        }

        if (!props.goal?.trim() || !props.context?.trim()) {
            return {
                level: "partial",
                message: "Some inputs missing — output may vary.",
            };
        }

        return {
            level: "ready",
            message: "Inputs look strong for generation.",
        };
    }, [props.topic, props.goal, props.context]);
    // === PATCH:STEP17 ===
    // === PATCH:STEP18 ===
    const generationConfidence = useMemo(() => {
        if (inputReadiness?.level === "ready") {
            return {
                level: "high",
                note: "Inputs well aligned — strong generation expected.",
            };
        }

        if (!props.topic || !props.goal) {
            return {
                level: "low",
                note: "Low confidence — refine inputs.",
            };
        }

        return {
            level: "medium",
            note: "Moderate confidence — minor adjustments may help.",
        };
    }, [inputReadiness, props.topic, props.goal]);
    // === PATCH:STEP18 ===
    // === PATCH:STEP19 ===
    const autoFixSuggestions = useMemo(() => {
        const suggestions: string[] = [];

        if (inputReadiness.level === "weak") {
            suggestions.push("Add a clearer topic or short source text.");
        }

        if (inputReadiness.level === "partial") {
            suggestions.push("Add context to improve generation stability.");
        }

        if (intentConsistencyPreview?.level === "warning") {
            suggestions.push("Align goal more closely with detected topic intent.");
        }

        if (presetIntentAdvisory?.level === "hint") {
            suggestions.push("Consider switching preset for a better fit.");
        }

        if (!props.context?.trim()) {
            suggestions.push("Add a short production context for clearer direction.");
        }

        return suggestions.slice(0, 3);
    }, [
        inputReadiness.level,
        intentConsistencyPreview?.level,
        presetIntentAdvisory?.level,
        props.context,
    ]);
    // === PATCH:STEP19 ===
    const contentSignalPreview = useMemo(() => {
        const topicSignal = getTopicSignal(props.topic);
        const sourceSignal = getSourceSignal(sourceText);
        const contentShape = getContentShape(props.topic, props.chapter, sourceText);
        const hint = getContentSignalHint({
            topic: props.topic,
            chapter: props.chapter,
            sourceText,
        });

        return {
            topicSignal,
            sourceSignal,
            contentShape,
            hint,
        };
    }, [props.topic, props.chapter, sourceText]);
    // patch 20
    const getQuickSuggestionAction = (suggestion: string) => {
        const s = suggestion.toLowerCase();

        if (s.includes("add context") || s.includes("production context")) {
            return {
                type: "apply-context" as const,
                label: "Apply context",
            };
        }

        if (s.includes("align goal")) {
            return {
                type: "open-intent" as const,
                label: "Open Intent",
            };
        }

        if (s.includes("switching preset") || s.includes("switch preset")) {
            return {
                type: "open-preset" as const,
                label: "Open Preset",
            };
        }

        return null;
    };

    // PATCH-22
    const applyQuickSuggestion = (suggestion: string) => {
        const action = getQuickSuggestionAction(suggestion);
        if (!action) return;

        if (action.type === "apply-context") {
            if (!props.context.trim()) {
                props.onContextChange(
                    "clear production direction with stable visual focus, clean structure, and explicit labeling"
                );
            }
            setActiveTab("intent");
            return;
        }

        if (action.type === "open-intent") {
            setActiveTab("intent");
            return;
        }

        if (action.type === "open-preset") {
            setActiveTab("preset");
            return;
        }
    };
    //patch 20.5
    //const intentOwnershipHint = `activePreset = ${String(props.activePreset || "EMPTY")}`;
    const intentOwnershipHint = props.activePreset
        ? "Goal / Context currently aligned with preset behavior."
        : "Goal / Context can be guided by preset selection.";
    // PATCH-23
    const inputReadinessTone =
        inputReadiness.level === "ready"
            ? "border-emerald-700 bg-emerald-950/30 text-emerald-300"
            : inputReadiness.level === "partial"
                ? "border-amber-700 bg-amber-950/30 text-amber-300"
                : "border-red-700 bg-red-950/30 text-red-300";
    // PATCH-22 helper
    const { topic, goal, context } = props;
    const inputQualityScore = useMemo(() => {
        let score = 0;

        if (topic?.trim()) score += 40;
        if (goal?.trim()) score += 30;
        if (context?.trim().length > 10) score += 30;

        return score;
    }, [topic, goal, context]);
    // PATCH-24
    const generationConfidenceTone =
        generationConfidence.level === "high"
            ? "border-emerald-700 bg-emerald-950/30 text-emerald-300"
            : generationConfidence.level === "medium"
                ? "border-amber-700 bg-amber-950/30 text-amber-300"
                : "border-red-700 bg-red-950/30 text-red-300";
    // PATCH-26
    const isWeak =
        inputReadiness.status?.toLowerCase() === "weak" ||
        inputQualityScore < 30;
    // PATCH-27
    const qualityRef = useRef<HTMLDivElement | null>(null);
    //patch 21
    //const togglePreset = (preset: string) => {
    //  props.onPresetChange(props.activePreset === preset ? "" : preset);
    //};
    const topicBrain = useMemo(() => inferTopicBrain(props.topic), [props.topic]);
    const suggestions = useMemo(() => buildSuggestions(props.topic), [props.topic]);
    const topicWarning = getTopicWarning(props.topic);
    const goalWarning = getGoalWarning(props.goal);
    const contextWarning = getContextWarning(props.context);
    const inputScore = scoreInput(props.topic, props.goal, props.context);
    const readyState = inputScore >= 70 ? "Ready" : "Needs more detail";

    const tabs: { id: InputTab; label: string }[] = [
        { id: "preset", label: "Preset" },
        { id: "content", label: "Content" },
        { id: "intent", label: "Intent" },
        { id: "style", label: "Style" },
        { id: "quality", label: "Quality" },
    ];

    return (
        <div className="rounded-2xl bg-gray-900 p-5 space-y-4">
            <div className="sticky top-0 z-20 -mx-5 border-b border-gray-800 bg-gray-900/95 px-5 py-3 backdrop-blur">
                <div className="grid grid-cols-5 gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`rounded-lg px-3 py-2 text-sm transition ${activeTab === tab.id
                                ? "bg-white text-black"
                                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === "preset" && (
                <Box
                    title="Presets"
                    subtitle="Quick start modes for the current input workflow."
                >
                    <div className="grid grid-cols-1 gap-3">
                        <PresetCard
                            title="Quick Mode"
                            desc="Fast output with minimal structure. Best for testing ideas."
                            active={props.activePreset === "quick"}
                            onClick={() =>
                                props.activePreset === "quick"
                                    ? props.onClearAutoLocks?.()
                                    : props.onApplyPreset("quick")
                            }
                        />
                        <PresetCard
                            title="Pro Mode"
                            desc="Detailed and structured output for production-level visuals."
                            active={props.activePreset === "pro"}
                            onClick={() =>
                                props.activePreset === "pro"
                                    ? props.onClearAutoLocks?.()
                                    : props.onApplyPreset("pro")
                            }
                        />
                        <PresetCard
                            title="Canva Mode"
                            desc="Optimized layout for Canva. Locks style and depth for consistency."
                            active={props.activePreset === "canva"}
                            onClick={() =>
                                props.activePreset === "canva"
                                    ? props.onClearAutoLocks?.()
                                    : props.onApplyPreset("canva")
                            }
                        />
                    </div>
                    {/* === PATCH:PRESET_BRAIN === */}
                    <Box
                        title="Preset Brain"
                        subtitle="Preview only — shows what this preset is optimized for"
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg bg-gray-900 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Intent
                                </div>
                                <div className="mt-2 text-sm text-white">{presetIntentAdvisory?.intent}</div>
                            </div>

                            <div className="rounded-lg bg-gray-900 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Layout
                                </div>
                                <div className="mt-2 text-sm text-white">{presetIntentAdvisory?.layout}</div>
                            </div>

                            <div className="rounded-lg bg-gray-900 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Complexity
                                </div>
                                <div className="mt-2 text-sm text-white">{presetIntentAdvisory?.complexity}</div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-3 text-xs text-gray-300">
                            Reason: {presetIntentAdvisory?.reason}
                        </div>
                    </Box>
                    {/* === PATCH:PRESET_BRAIN end === */}
                    {/* === PATCH:14 === */}
                    <Box
                        title="Preset Advisory"
                        subtitle="Preview only — suggests better preset for detected intent"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-gray-900 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Status
                                </div>
                                <div className="mt-2 text-sm text-white">
                                    {presetIntentAdvisory?.level}
                                </div>
                            </div>

                            <div className="rounded-lg bg-gray-900 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Suggestion
                                </div>
                                <div className="mt-2 text-xs text-gray-300">
                                    {presetIntentAdvisory?.message}
                                </div>
                            </div>
                        </div>
                    </Box>
                    {/* === PATCH:14 === */}
                    {props.activePreset === "canva" && props.onClearAutoLocks ? (
                        <div className="rounded-lg border border-blue-900 bg-blue-950/40 px-3 py-3 text-sm text-blue-200">
                            Canva preset auto-locks Style and Depth for stable design output.
                            <button
                                type="button"
                                onClick={props.onClearAutoLocks}
                                className="mt-3 block rounded-lg bg-blue-200 px-3 py-2 text-sm font-medium text-black hover:opacity-90"
                            >
                                Unlock Canva Auto Locks
                            </button>
                        </div>
                    ) : null}
                </Box>
            )}

            {activeTab === "content" && (
                <Box
                    title="Content"
                    subtitle="Core book content that defines what the image is about."
                >
                    <div className="space-y-4">
                        <Field label="Mode" hint="Production scope">
                            <select
                                className={inputClass}
                                value={props.mode}
                                onChange={(e) => props.onModeChange(e.target.value as Mode)}
                            >
                                <option value="single">Single</option>
                                <option value="chapter">Chapter</option>
                                <option value="book">Book</option>
                            </select>
                        </Field>

                        <Field label="Topic" hint="What exact subject should the image explain?">
                            <input
                                className={inputClass}
                                value={props.topic}
                                onChange={(e) => props.onTopicChange(e.target.value)}
                                onBlur={(e) => props.onTopicChange(safeTypoFixTopic(e.target.value))}
                                placeholder="e.g. Root Health vs Root Rot"
                            />
                            <WarningText text={topicWarning} />
                        </Field>

                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => props.onTopicChange(item)}
                                    className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-300 hover:border-gray-500 hover:text-white"
                                >
                                    {item}
                                </button>
                            ))}
                        </div>

                        {/* === PATCH:CONTENT_EXTRA === */}
                        <Box
                            title="Smart Topic Brain"
                            subtitle="Preview only — does not change output"
                        >
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-gray-900 rounded-lg p-2">
                                    <div className="text-gray-500">Intent</div>
                                    <div className="text-white">{topicBrain.intent}</div>
                                </div>

                                <div className="bg-gray-900 rounded-lg p-2">
                                    <div className="text-gray-500">Layout</div>
                                    <div className="text-white">{topicBrain.layout}</div>
                                </div>

                                <div className="bg-gray-900 rounded-lg p-2">
                                    <div className="text-gray-500">Complexity</div>
                                    <div className="text-white">{topicBrain.complexity}</div>
                                </div>
                            </div>

                            <div className="text-xs text-gray-400">
                                Reason: {topicBrain.reason}
                            </div>
                        </Box>
                        <Box
                            title="Content Signal Preview"
                            subtitle="Preview only — checks content strength without changing output"
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg bg-gray-900 px-3 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                        Topic Signal
                                    </div>
                                    <div className="mt-2 text-sm text-white">
                                        {contentSignalPreview.topicSignal}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-900 px-3 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                        Source Signal
                                    </div>
                                    <div className="mt-2 text-sm text-white">
                                        {contentSignalPreview.sourceSignal}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-900 px-3 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                        Content Shape
                                    </div>
                                    <div className="mt-2 text-sm text-white">
                                        {contentSignalPreview.contentShape}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-3 text-xs text-gray-300">
                                Hint: {contentSignalPreview.hint}
                            </div>
                        </Box>

                        <Field label="Chapter" hint="Book position or section">
                            <input
                                className={inputClass}
                                value={props.chapter}
                                onChange={(e) => props.onChapterChange(e.target.value)}
                                onBlur={(e) => props.onChapterChange(safeTypoFixChapter(e.target.value))}
                                placeholder="e.g. Chapter 6 — Root Health"
                            />
                        </Field>

                        <Field
                            label="Source Text (optional)"
                            hint="Local note only for now — not sent to backend"
                        >
                            <textarea
                                className={`${inputClass} min-h-[120px] resize-y`}
                                value={sourceText}
                                onChange={(e) => setSourceText(e.target.value)}
                                placeholder="Paste a paragraph or short section from the book here for your own reference..."
                            />
                        </Field>
                        <Box
                            title="Intent Consistency"
                            subtitle="Preview only — checks alignment between topic, goal and context"
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg bg-gray-900 px-3 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                        Detected Intent
                                    </div>
                                    <div className="mt-2 text-sm text-white">
                                        {intentConsistencyPreview?.intent}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-900 px-3 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                        Status
                                    </div>
                                    <div className="mt-2 text-sm text-white">
                                        {intentConsistencyPreview?.level}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-900 px-3 py-3">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                        Message
                                    </div>
                                    <div className="mt-2 text-xs text-gray-300">
                                        {intentConsistencyPreview?.message}
                                    </div>
                                </div>
                            </div>
                        </Box>
                    </div>
                </Box>
            )}

            {activeTab === "intent" && (
                <Box
                    title="Intent"
                    subtitle="Why this image is needed and what it should communicate."
                >
                    <div className="mb-3 rounded-md border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-400">
                        {intentOwnershipHint}
                    </div>
                    <div className="space-y-4">
                        <Field
                            label="Goal"
                            hint="What should the reader understand after seeing the image?"
                        >
                            <input
                                className={inputClass}
                                value={props.goal}
                                onChange={(e) => props.onGoalChange(e.target.value)}
                                onBlur={(e) => props.onGoalChange(safeTypoFixGoal(e.target.value))}
                                placeholder="e.g. visual comparison for quick diagnosis"
                            />
                            <WarningText text={goalWarning} />
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => props.onGoalChange(improveGoal(props.goal, props.topic))}
                                    className="rounded-md bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
                                >
                                    Make clearer
                                </button>
                            </div>
                        </Field>

                        <Field
                            label="Context"
                            hint="Add system, scenario, audience, or constraints"
                        >
                            <textarea
                                className={`${inputClass} min-h-[100px] resize-y`}
                                value={props.context}
                                onChange={(e) => props.onContextChange(e.target.value)}
                                placeholder="e.g. hydroponic DWC educational diagram focused on root health indicators"
                            />
                            <WarningText text={contextWarning} />
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => props.onContextChange(improveContext(props.context, props.topic))}
                                    className="rounded-md bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
                                >
                                    Add detail
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        props.onContextChange(
                                            `${improveContext(props.context, props.topic)} for educational book illustration`
                                        )
                                    }
                                    className="rounded-md bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
                                >
                                    Use book style
                                </button>
                            </div>
                        </Field>
                    </div>
                </Box>

            )
            }

            {activeTab === "style" && (
                <>
                    <Box
                        title="Hints"
                        subtitle="Optional controls that guide the engine without changing the fixed output logic."
                    >
                        <div className="space-y-4">
                            <Field label="Visual Style" hint="Optional look-and-feel guidance">
                                <input
                                    className={`${inputClass} ${props.locks.style ? "opacity-60" : ""}`}
                                    value={props.visualStyle}
                                    onChange={(e) => props.onStyleChange(e.target.value)}
                                    placeholder="e.g. clean educational infographic"
                                    disabled={props.locks.style}
                                />
                            </Field>

                            <Field label="Output Depth" hint="How dense the output should feel">
                                <select
                                    className={`${inputClass} ${props.locks.depth ? "opacity-60" : ""}`}
                                    value={props.outputDepth}
                                    onChange={(e) => props.onDepthChange(e.target.value)}
                                    disabled={props.locks.depth}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </Field>
                        </div>
                    </Box>

                    <Box
                        title="Field Locks"
                        subtitle="Freeze style and depth so presets cannot overwrite them."
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => props.onToggleLock("style")}
                                    className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${props.locks.style
                                        ? "bg-white text-black"
                                        : "border border-gray-700 bg-gray-900 text-white"
                                        }`}
                                >
                                    Style Lock: {props.locks.style ? "ON" : "OFF"}
                                </button>
                                <Tooltip text="Locks the visual style. Presets and automatic changes cannot overwrite your selected style." />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => props.onToggleLock("depth")}
                                    className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${props.locks.depth
                                        ? "bg-white text-black"
                                        : "border border-gray-700 bg-gray-900 text-white"
                                        }`}
                                >
                                    Depth Lock: {props.locks.depth ? "ON" : "OFF"}
                                </button>
                                <Tooltip text="Locks the output depth. Presets and automatic changes cannot overwrite the selected detail level." />
                            </div>
                        </div>
                    </Box>
                </>
            )}

            {activeTab === "quality" && (
                <>
                    {/* PATCH-27.2 */}
                    <div ref={qualityRef} className="space-y-3.5">
                        {/* PATCH-29 */}
                        <div className="grid items-stretch gap-2 md:grid-cols-2 2xl:grid-cols-4 pb-2.5 mb-1.5 border-b border-white/5">
                            <div className="flex h-full min-h-[124px] flex-col rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-150 hover:bg-white/[0.06] hover:border-white/15">
                                <div className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-neutral-400/80">
                                    Readiness
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-white/95">
                                        {inputReadiness.level}
                                    </span>
                                    <span
                                        className={[
                                            "rounded-full px-2.5 py-[3px] text-[11px] leading-none font-medium capitalize",
                                            inputReadiness.level === "ready"
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : inputReadiness.level === "partial"
                                                    ? "bg-amber-500/15 text-amber-300"
                                                    : "bg-rose-500/15 text-rose-300",
                                        ].join(" ")}
                                    >
                                        {inputReadiness.level}
                                    </span>
                                </div>

                                <div className="mt-auto max-w-[30ch] pt-2 text-[12px] leading-[1.5] text-neutral-400/90 text-left" dir="ltr">
                                    {inputReadiness.message}
                                </div>
                            </div>

                            <div className="flex h-full min-h-[124px] flex-col rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-150 hover:bg-white/[0.06] hover:border-white/15">
                                <div className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-neutral-400/80">
                                    Confidence
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-white/95">
                                        {generationConfidence.level}
                                    </span>
                                    <span
                                        className={[
                                            "rounded-full px-2.5 py-[3px] text-[11px] leading-none font-medium capitalize",
                                            generationConfidence.level === "high"
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : generationConfidence.level === "medium"
                                                    ? "bg-amber-500/15 text-amber-300"
                                                    : "bg-rose-500/15 text-rose-300",
                                        ].join(" ")}
                                    >
                                        {generationConfidence.level}
                                    </span>
                                </div>

                                <div className="mt-auto max-w-[30ch] pt-2 text-[12px] leading-[1.5] text-neutral-400/90 text-left" dir="ltr">
                                    {generationConfidence.note}
                                </div>
                            </div>

                            <div className="flex h-full min-h-[124px] flex-col rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-150 hover:bg-white/[0.06] hover:border-white/15">
                                <div className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-neutral-400/80">
                                    Intent Match
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-white">
                                        {intentConsistencyPreview.intent || "—"}
                                    </span>
                                    <span
                                        className={[
                                            "rounded-full px-2.5 py-[3px] text-[11px] leading-none font-medium capitalize",
                                            intentConsistencyPreview.level === "strong"
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : intentConsistencyPreview.level === "medium"
                                                    ? "bg-amber-500/15 text-amber-300"
                                                    : "bg-rose-500/15 text-rose-300",
                                        ].join(" ")}
                                    >
                                        {intentConsistencyPreview.level}
                                    </span>
                                </div>

                                <div className="mt-auto max-w-[30ch] pt-2 text-[12px] leading-[1.5] text-neutral-400/90 text-left" dir="ltr">
                                    {intentConsistencyPreview.message}
                                </div>
                            </div>

                            <div className="flex h-full min-h-[124px] flex-col rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-150 hover:bg-white/[0.06] hover:border-white/15">
                                <div className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-neutral-400/80">
                                    Preset Advisory
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-white/95">
                                        {presetIntentAdvisory.level}
                                    </span>
                                    <span
                                        className={[
                                            "rounded-full px-2.5 py-[3px] text-[11px] leading-none font-medium capitalize",
                                            presetIntentAdvisory.level === "strong"
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : presetIntentAdvisory.level === "medium"
                                                    ? "bg-amber-500/15 text-amber-300"
                                                    : "bg-rose-500/15 text-rose-300",
                                        ].join(" ")}
                                    >
                                        {presetIntentAdvisory.level}
                                    </span>
                                </div>

                                <div className="mt-auto max-w-[30ch] pt-2 text-[12px] leading-[1.5] text-neutral-400/90 text-left" dir="ltr">
                                    {presetIntentAdvisory.message}
                                </div>
                            </div>
                        </div>
                        <Box
                            title="Input Quality Guard"
                            subtitle="Checks input strength before the next run without changing output logic."
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="text-[13px] text-gray-200">
                                    Input Quality:{" "}
                                    <span className="text-[13px] font-semibold text-white/95">{inputScore}%</span>
                                </div>

                                {/* PATCH-22: Quality Score Progress Bar */}
                                <div className="min-w-[180px] flex-1">
                                    <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-400/90">
                                        <span>Strength</span>
                                        <span>{inputQualityScore}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                                        <div
                                            className={`h-full transition-all duration-500 ${inputQualityScore < 30
                                                ? "bg-red-500"
                                                : inputQualityScore < 70
                                                    ? "bg-yellow-500"
                                                    : "bg-green-500"
                                                }`}
                                            style={{ width: `${inputQualityScore}%` }}
                                        />
                                    </div>
                                    {/* PATCH-22: Quality Score Progress Bar */}
                                </div>

                                <div
                                    className={`rounded-full px-2.5 py-[3px] text-[11px] leading-none font-medium ${inputScore >= 70
                                        ? "bg-green-900 text-green-300"
                                        : "bg-yellow-900 text-yellow-300"
                                        }`}
                                >
                                    {readyState}
                                </div>
                            </div>

                            <div className="grid gap-1.5 text-[12px] leading-5 text-gray-300/90">
                                <div>• Topic: {topicWarning || "Looks good"}</div>
                                <div>• Goal: {goalWarning || "Looks good"}</div>
                                <div>• Context: {contextWarning || "Looks good"}</div>
                            </div>
                        </Box>
                        {/* === PATCH:STEP17 UI === */}
                        <Box
                            title="Input Readiness"
                            subtitle="Preview only — checks if inputs are sufficient"
                            className="transition-colors hover:bg-white/[0.02]"
                        >
                            <div className="grid gap-2 md:grid-cols-2">
                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                                        Status
                                    </div>
                                    {/* PATCH-23-UI */}
                                    <div
                                        className={`inline-flex rounded-full border px-2.5 py-[3px] text-[11px] leading-none font-medium uppercase tracking-[0.14em] ${inputReadiness.level === "ready"
                                            ? "border-emerald-700 bg-emerald-950/30 text-emerald-300"
                                            : inputReadiness.level === "partial"
                                                ? "border-amber-700 bg-amber-950/30 text-amber-300"
                                                : "border-red-700 bg-red-950/30 text-red-300"
                                            }`}
                                    >
                                        {inputReadiness.level}
                                    </div>
                                    {/* PATCH-23-UI */}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                                        Note
                                    </div>
                                    <div className="mt-2 text-[12px] leading-5 text-gray-300/90" dir="ltr">
                                        {inputReadiness.message}
                                    </div>
                                </div>
                            </div>
                        </Box>
                        {/* === PATCH:STEP18 UI === */}
                        <Box
                            title="Generation Confidence"
                            subtitle="Preview only — overall system confidence"
                            className="transition-colors hover:bg-white/[0.02]"
                        >
                            <div className="grid gap-2 md:grid-cols-2">
                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                                        Level
                                    </div>
                                    {/* PATCH-24 */}
                                    <div
                                        className={`inline-flex rounded-full border px-2.5 py-[3px] text-[11px] leading-none font-medium uppercase tracking-[0.14em] ${generationConfidence.level === "high"
                                            ? "border-emerald-700 bg-emerald-950/30 text-emerald-300"
                                            : generationConfidence.level === "medium"
                                                ? "border-amber-700 bg-amber-950/30 text-amber-300"
                                                : "border-red-700 bg-red-950/30 text-red-300"
                                            }`}
                                    >
                                        {generationConfidence.level}
                                    </div>
                                    {/* PATCH-24 */}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                                        Note
                                    </div>
                                    <div className="mt-2 text-[12px] leading-5 text-gray-300/90" dir="ltr">
                                        {generationConfidence.note}
                                    </div>
                                </div>
                            </div>
                        </Box>
                        {/* === PATCH:STEP19 UI === */}
                        <Box
                            title="Auto Fix Suggestions"
                            subtitle="Preview only — suggests safe next improvements"
                        >
                            {autoFixSuggestions.length > 0 ? (
                                <div className="grid gap-2.5">
                                    {/* === PATCH:STEP21 UI === */}
                                    {autoFixSuggestions.map((suggestion, index) => {
                                        const action = getQuickSuggestionAction(suggestion);

                                        const isStrong =
                                            suggestion.toLowerCase().includes("add context") ||
                                            suggestion.toLowerCase().includes("align goal");

                                        return (
                                            <div
                                                key={`${suggestion}-${index}`}
                                                className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${isStrong
                                                    ? "border-amber-700 bg-amber-950/25"
                                                    : "border-white/10 bg-white/[0.035]"
                                                    }`}
                                            >
                                                <div className="min-w-0 text-[13px] leading-5 text-neutral-300/95" dir="ltr">
                                                    {suggestion}
                                                </div>

                                                {action ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => applyQuickSuggestion(suggestion)}
                                                        className="shrink-0 rounded-lg border border-white/10 px-2.5 py-[6px] text-[11px] font-medium text-neutral-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                                                    >
                                                        {action.label}
                                                    </button>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-[13px] text-gray-200">
                                    No fixes suggested. Inputs look stable.
                                </div>
                            )}
                        </Box>
                        {/* === PATCH:STEP17 UI === */}
                        {/* PATCH-30 */}
                        <Box
                            title="Input Summary"
                            subtitle="Current values that will be used on the next run."
                            className="transition-colors hover:bg-white/[0.02]"
                        >
                            <div className="grid gap-2.5 text-sm">
                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Mode</div>
                                    <div className="text-[13px] text-white/95">{props.summary.mode}</div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Topic</div>
                                    <div className="break-words text-[13px] leading-5 text-white/95">
                                        {props.summary.topic || "-"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Goal</div>
                                    <div className="break-words text-[13px] leading-5 text-white/95">
                                        {props.summary.goal || "-"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Context</div>
                                    <div className="break-words text-[13px] leading-5 text-white/95">
                                        {props.summary.context || "-"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Style</div>
                                    <div className="text-[13px] text-white/95">{props.summary.visualStyle || "-"}</div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Depth</div>
                                    <div className="text-[13px] text-white/95">{props.summary.outputDepth || "-"}</div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Preset</div>
                                    <div className="text-[13px] text-white/95">{props.summary.preset || "-"}</div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Chapter</div>
                                    <div className="break-words text-[13px] leading-5 text-white/95">
                                        {props.summary.chapter || "-"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-[92px_1fr] items-start gap-2.5">
                                    <div className="text-[12px] text-neutral-400/90">Source Text</div>
                                    <div className="text-[13px] text-white/95">{sourceText?.trim() ? "Yes" : "-"}</div>
                                </div>
                            </div>
                        </Box>
                    </div>
                </>
            )
            }

            {/* PATCH-26 */}
            <button
                onClick={props.onRun}
                disabled={isWeak}
                title={isWeak ? "Inputs too weak — add topic/goal/context" : "Run production"}
                className={`w-full rounded-lg px-4 py-3 text-sm font-medium transition
                    ${isWeak
                        ? "cursor-not-allowed bg-neutral-800 text-neutral-500"
                        : "bg-white text-black hover:bg-neutral-200"
                    }`}
            >
                Run Production
            </button>
        </div >
    );
}
