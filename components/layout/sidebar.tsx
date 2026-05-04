"use client";

import { useState } from "react";

type RunItem = {
    id: number;
    mode: string;
    topic: string;
    chapter: string;
    output: any;
    source?: "ai" | "fallback";
    createdAt: string;
};

type SidebarProps = {
    runs: RunItem[];
    onSelectRun: (run: RunItem) => void;
};

export function Sidebar({ runs, onSelectRun }: SidebarProps) {
    const [activeId, setActiveId] = useState<number | null>(null);

    function handleClick(run: RunItem) {
        setActiveId(run.id);
        onSelectRun(run);
    }

    return (
        <aside className="bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-bold">A.G</h2>
                <p className="text-xs text-gray-400">Visual Production</p>
            </div>

            <nav className="p-4 space-y-2 border-b border-gray-800">
                <div className="text-sm text-gray-300">Dashboard</div>
                <div className="text-sm text-gray-300">Runs</div>
                <div className="text-sm text-gray-300">Templates</div>
                <div className="text-sm text-gray-300">Outputs</div>
            </nav>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <h3 className="text-xs text-gray-500 mb-2">Recent Runs</h3>

                {runs.length === 0 && (
                    <div className="text-xs text-gray-600">No runs yet...</div>
                )}

                {runs.map((run) => (
                    <div
                        key={run.id}
                        onClick={() => handleClick(run)}
                        className={`p-3 rounded-lg cursor-pointer transition ${activeId === run.id
                                ? "bg-blue-600 text-white"
                                : "bg-gray-800 hover:bg-gray-700"
                            }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs opacity-70 mb-1">
                                {run.mode.toUpperCase()}
                            </div>
                            <div
                                className={`text-[10px] px-2 py-0.5 rounded-full ${run.source === "ai"
                                        ? "bg-green-900 text-green-300"
                                        : "bg-yellow-900 text-yellow-300"
                                    }`}
                            >
                                {run.source === "ai" ? "AI" : "Fallback"}
                            </div>
                        </div>

                        <div className="text-sm font-medium truncate">
                            {run.topic || run.chapter || "Untitled"}
                        </div>

                        <div className="text-[10px] opacity-50 mt-1">
                            {new Date(run.createdAt).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
}