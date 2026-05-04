"use client";

import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ProductionPanel } from "@/components/production/production-panel";
import { OutputPanel } from "@/components/production/output-panel";
import { Mode, OutputTab, RunOutput } from "@/types/production";

type ValidationStatus = "ai" | "repaired" | "fallback" | null;
type PresetKey = "quick" | "pro" | "canva";

type Summary = {
  mode: Mode;
  topic: string;
  chapter: string;
  goal: string;
  context: string;
  visualStyle: string;
  outputDepth: string;
  preset?: PresetKey | null;
};

type Interpretation = {
  visualType?: string;
  layout?: string;
  focus?: string;
  complexity?: string;
  notes?: string;
} | null;

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [topic, setTopic] = useState("");
  const [chapter, setChapter] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [outputDepth, setOutputDepth] = useState("medium");
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);

  const [locks, setLocks] = useState({
    style: false,
    depth: false,
  });

  const [output, setOutput] = useState<RunOutput | null>(null);
  const [tab, setTab] = useState<OutputTab>("prompt");
  const [runSource, setRunSource] = useState<"ai" | "fallback" | null>(null);
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>(null);
  const [interpretation, setInterpretation] = useState<Interpretation>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canRun = topic.trim().length > 0;

  function toggleLock(key: "style" | "depth") {
    setLocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function applyPreset(preset: PresetKey) {
    setActivePreset(preset);

    if (preset === "quick") {
      setMode("single");
      setGoal("Fast visual output");
      setContext("Quick production mode with minimal setup.");
      if (!locks.style) setVisualStyle("Clean educational visual");
      if (!locks.depth) setOutputDepth("low");
      return;
    }

    if (preset === "pro") {
      setMode("chapter");
      setGoal("Detailed production-ready visual");
      setContext("Structured layout, stronger hierarchy, and higher content precision.");
      if (!locks.style) setVisualStyle("Professional infographic layout");
      if (!locks.depth) setOutputDepth("high");
      return;
    }

    if (preset === "canva") {
      setMode("single");
      setGoal("Canva-ready structured page");
      setContext("Generate layout blocks ready for Canva page composition.");
      if (!locks.style) {
        setVisualStyle("Canva educational card system");
        setLocks((prev) => ({ ...prev, style: true }));
      }
      if (!locks.depth) {
        setOutputDepth("medium");
        setLocks((prev) => ({ ...prev, depth: true }));
      }
    }
  }

  function clearAutoLocks() {
    if (activePreset === "canva") {
      setLocks((prev) => ({ ...prev, style: false, depth: false }));
    }
  }

  async function handleRun() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          topic,
          chapter,
          goal,
          context,
          visualStyle,
          outputDepth,
        }),
      });

      const data = await res.json();

      setOutput(data.data);
      setRunSource(data.source || "ai");
      setValidationStatus(data.validationStatus || "ai");
      setInterpretation(data.interpretation || null);
      setTab("prompt");
    } catch {
      setErrorMessage("Run failed");
      setRunSource("fallback");
      setValidationStatus("fallback");
      setInterpretation(null);
    } finally {
      setIsLoading(false);
    }
  }

  const summary: Summary = useMemo(
    () => ({
      mode,
      topic,
      chapter,
      goal,
      context,
      visualStyle,
      outputDepth,
      preset: activePreset,
    }),
    [
      mode,
      topic,
      chapter,
      goal,
      context,
      visualStyle,
      outputDepth,
      activePreset,
    ]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <Sidebar runs={[]} onSelectRun={() => { }} />

        <main className="p-6 space-y-6">
          <h1 className="text-xl font-semibold">Input Summary + Lock Panel</h1>

          <div className="grid xl:grid-cols-[420px_1fr] gap-6">
            <ProductionPanel
              mode={mode}
              topic={topic}
              chapter={chapter}
              goal={goal}
              context={context}
              visualStyle={visualStyle}
              outputDepth={outputDepth}
              activePreset={activePreset}
              locks={locks}
              summary={summary}
              onToggleLock={toggleLock}
              onApplyPreset={applyPreset}
              onClearAutoLocks={clearAutoLocks}
              onModeChange={setMode}
              onTopicChange={setTopic}
              onChapterChange={setChapter}
              onGoalChange={setGoal}
              onContextChange={setContext}
              onStyleChange={(v) => !locks.style && setVisualStyle(v)}
              onDepthChange={(v) => !locks.depth && setOutputDepth(v)}
              canRun={canRun}
              isLoading={isLoading}
              onRun={handleRun}
            />

            <OutputPanel
              activeTab={tab}
              output={output}
              onTabChange={setTab}
              isLoading={isLoading}
              runSource={runSource}
              errorMessage={errorMessage}
              onRetry={handleRun}
              validationStatus={validationStatus}
              interpretation={interpretation}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
