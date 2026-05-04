"use client";

import { useMemo, useState } from "react";
import { OutputTab, RunOutput } from "@/types/production";

const tabs: OutputTab[] = ["prompt", "blueprint", "overlay", "notes", "canva"];
type CanvaView = "standard" | "ebook" | "infographic";
type ValidationStatus = "ai" | "repaired" | "fallback" | null;

type Interpretation = {
    visualType?: string;
    layout?: string;
    focus?: string;
    complexity?: string;
    notes?: string;
} | null;

type OutputPanelProps = {
    activeTab: OutputTab;
    output: RunOutput | null;
    onTabChange: (tab: OutputTab) => void;
    isLoading: boolean;
    runSource: "ai" | "fallback" | null;
    errorMessage: string;
    onRetry: () => void;
    validationStatus?: ValidationStatus;
    interpretation?: Interpretation;
};

function extractCanvaSections(canvaText: string) {
    const s = "CANVA STANDARD";
    const e = "CANVA EBOOK PAGE";
    const i = "CANVA INFOGRAPHIC PAGE";

    const sIndex = canvaText.indexOf(s);
    const eIndex = canvaText.indexOf(e);
    const iIndex = canvaText.indexOf(i);

    if (sIndex === -1 || eIndex === -1 || iIndex === -1) {
        return {
            standard: canvaText,
            ebook: canvaText,
            infographic: canvaText,
        };
    }

    return {
        standard: canvaText.slice(sIndex + s.length, eIndex).trim(),
        ebook: canvaText.slice(eIndex + e.length, iIndex).trim(),
        infographic: canvaText.slice(iIndex + i.length).trim(),
    };
}

function parseCanvaBlock(text: string) {
    const sections = [
        "Page Title",
        "Subtitle",
        "Header Block",
        "Main Block",
        "Side Labels",
        "Footer",
        "Design Notes",
    ];

    const map: Record<string, string> = {};

    sections.forEach((name, idx) => {
        const start = text.indexOf(name + ":");
        if (start === -1) return;

        let end = text.length;

        for (let i = idx + 1; i < sections.length; i++) {
            const next = text.indexOf(sections[i] + ":");
            if (next !== -1) {
                end = next;
                break;
            }
        }

        map[name] = text.slice(start + name.length + 1, end).trim();
    });

    return {
        pageTitle: map["Page Title"] || "",
        subtitle: map["Subtitle"] || "",
        header: map["Header Block"] || "",
        main: map["Main Block"] || "",
        footer: map["Footer"] || "",
        labels: (map["Side Labels"] || "")
            .split("\n")
            .map((l) => l.replace(/^-/, "").trim())
            .filter(Boolean),
        notes: (map["Design Notes"] || "")
            .split("\n")
            .map((n) => n.replace(/^-/, "").trim())
            .filter(Boolean),
    };
}

function parseMainLayoutItems(mainText: string) {
    return mainText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const colonIndex = line.indexOf(":");
            if (colonIndex === -1) {
                return {
                    title: "Content",
                    content: line,
                };
            }

            return {
                title: line.slice(0, colonIndex).trim(),
                content: line.slice(colonIndex + 1).trim(),
            };
        });
}

function ValidationBadge({
    validationStatus,
}: {
    validationStatus: ValidationStatus;
}) {
    if (!validationStatus) return null;

    const badgeMap = {
        ai: { label: "Validated", className: "bg-green-900 text-green-300" },
        repaired: { label: "Repaired", className: "bg-blue-900 text-blue-300" },
        fallback: { label: "Fallback", className: "bg-yellow-900 text-yellow-300" },
    } as const;

    const badge = badgeMap[validationStatus];

    return (
        <div className={`rounded-full px-3 py-1 text-xs ${badge.className}`}>
            {badge.label}
        </div>
    );
}

function MiniCard({
    title,
    value,
}: {
    title: string;
    value: string;
}) {
    return (
        <div className="min-w-0 rounded-xl bg-gray-800 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white">
                {value || "—"}
            </div>
        </div>
    );
}

function LayoutCard({
    title,
    content,
}: {
    title: string;
    content: string;
}) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        if (!content) return;
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { }
    }

    return (
        <div className="flex min-h-[140px] min-w-0 flex-col rounded-xl bg-gray-800 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-gray-400">
                    {title}
                </div>

                <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 rounded-md bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
                >
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>

            <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white">
                {content || "—"}
            </div>
        </div>
    );
}

function renderMainByLayout(layout: string, mainText: string) {
    const items = parseMainLayoutItems(mainText);

    if (layout === "split") {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                {items.slice(0, 2).map((item, index) => (
                    <LayoutCard
                        key={`${item.title}-${index}`}
                        title={item.title}
                        content={item.content}
                    />
                ))}
            </div>
        );
    }

    if (layout === "flow") {
        return (
            <div className="grid gap-4">
                {items.map((item, index) => (
                    <LayoutCard
                        key={`${item.title}-${index}`}
                        title={item.title || `Step ${index + 1}`}
                        content={item.content}
                    />
                ))}
            </div>
        );
    }

    if (layout === "grid") {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                {items.slice(0, 4).map((item, index) => (
                    <LayoutCard
                        key={`${item.title}-${index}`}
                        title={item.title}
                        content={item.content}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            <LayoutCard
                title={items[0]?.title || "Center"}
                content={items[0]?.content || mainText}
            />
        </div>
    );
}

export function OutputPanel({
    activeTab,
    output,
    onTabChange,
    isLoading,
    runSource,
    errorMessage,
    onRetry,
    validationStatus = null,
    interpretation = null,
}: OutputPanelProps) {
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
    const [canvaView, setCanvaView] = useState<CanvaView>("standard");

    const canvaSections = useMemo(() => {
        if (!output?.canva) {
            return { standard: "", ebook: "", infographic: "" };
        }
        return extractCanvaSections(output.canva);
    }, [output]);

    const currentContent = useMemo(() => {
        if (!output) return "";
        return activeTab === "canva"
            ? canvaSections[canvaView]
            : output[activeTab];
    }, [output, activeTab, canvaSections, canvaView]);

    const parsed = useMemo(() => {
        if (activeTab !== "canva") return null;
        return parseCanvaBlock(currentContent);
    }, [activeTab, currentContent]);

    async function handleCopyCurrent() {
        if (!currentContent) return;
        try {
            await navigator.clipboard.writeText(currentContent);
            setCopyStatus("copied");
            setTimeout(() => setCopyStatus("idle"), 1200);
        } catch { }
    }

    function download(name: string, text: string) {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleExportCurrent() {
        if (!currentContent) return;

        const filename =
            activeTab === "canva"
                ? `canva-${canvaView}.txt`
                : `${activeTab}-output.txt`;

        download(filename, currentContent);
    }

    const layout = (interpretation?.layout || "central").toLowerCase();

    return (
        <div className="space-y-4 rounded-xl bg-gray-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => onTabChange(tab)}
                            className={`rounded-lg px-3 py-1 text-sm ${activeTab === tab
                                    ? "bg-white text-black"
                                    : "bg-gray-800 text-white"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <ValidationBadge validationStatus={validationStatus} />
                    {runSource && (
                        <div
                            className={`rounded-full px-3 py-1 text-xs ${runSource === "ai"
                                    ? "bg-green-900 text-green-300"
                                    : "bg-yellow-900 text-yellow-300"
                                }`}
                        >
                            {runSource === "ai" ? "AI Output" : "Fallback Output"}
                        </div>
                    )}
                </div>
            </div>

            {interpretation ? (
                <div className="rounded-xl bg-gray-800 p-4">
                    <div className="text-sm font-medium text-white">Interpretation</div>
                    <div className="mt-3 grid gap-2 text-sm text-gray-200 md:grid-cols-2">
                        <div>
                            <span className="text-gray-400">Visual Type:</span>{" "}
                            {interpretation.visualType || "-"}
                        </div>
                        <div>
                            <span className="text-gray-400">Layout:</span>{" "}
                            {interpretation.layout || "-"}
                        </div>
                        <div>
                            <span className="text-gray-400">Focus:</span>{" "}
                            {interpretation.focus || "-"}
                        </div>
                        <div>
                            <span className="text-gray-400">Complexity:</span>{" "}
                            {interpretation.complexity || "-"}
                        </div>
                        <div className="md:col-span-2">
                            <span className="text-gray-400">Notes:</span>{" "}
                            {interpretation.notes || "-"}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="space-y-4 rounded-xl bg-gray-800 p-4">
                {activeTab === "canva" && output && !isLoading ? (
                    <div className="flex flex-wrap gap-2">
                        {(["standard", "ebook", "infographic"] as CanvaView[]).map((view) => (
                            <button
                                key={view}
                                type="button"
                                onClick={() => setCanvaView(view)}
                                className={`rounded-lg px-3 py-1 text-sm ${canvaView === view
                                        ? "bg-white text-black"
                                        : "bg-gray-700 text-white"
                                    }`}
                            >
                                {view}
                            </button>
                        ))}
                    </div>
                ) : null}

                {output && !isLoading ? (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleCopyCurrent}
                            className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
                        >
                            {copyStatus === "copied" ? "Copied!" : "Copy"}
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCurrent}
                            className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
                        >
                            Export
                        </button>

                        <button
                            type="button"
                            onClick={onRetry}
                            className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
                        >
                            Retry
                        </button>
                    </div>
                ) : null}

                <div className="min-h-[420px] overflow-hidden rounded-xl bg-gray-900/60 p-4">
                    {isLoading ? (
                        <div className="text-sm text-gray-400">Loading...</div>
                    ) : activeTab === "canva" && parsed ? (
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <MiniCard title="Page Title" value={parsed.pageTitle} />
                                <MiniCard title="Subtitle" value={parsed.subtitle} />
                            </div>

                            <MiniCard title="Header" value={parsed.header} />

                            <div>
                                <div className="mb-3 text-xs uppercase tracking-wide text-gray-400">
                                    Main Layout — {layout}
                                </div>
                                {renderMainByLayout(layout, parsed.main)}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <MiniCard title="Footer" value={parsed.footer} />
                                <MiniCard title="Labels" value={parsed.labels.join("\n")} />
                            </div>

                            <MiniCard title="Notes" value={parsed.notes.join("\n")} />
                        </div>
                    ) : (
                        <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-white">
                            {currentContent}
                        </pre>
                    )}
                </div>

                {errorMessage ? (
                    <div className="break-words rounded-lg border border-yellow-700 bg-yellow-900/60 p-3 text-sm text-yellow-200">
                        {errorMessage}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
