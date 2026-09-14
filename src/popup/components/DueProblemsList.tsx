import React from "react";
import { DueProblemItem } from "./DueProblemItem";
import type { DueProblemItemData } from "../../domain/revision/RevisionQueueTypes";

interface DueProblemsListProps {
    items: DueProblemItemData[];
    loading: boolean;
    error: string | null;
    isAuthError: boolean;
    onViewAll: () => void;
}

export const DueProblemsList: React.FC<DueProblemsListProps> = ({
    items,
    loading,
    error,
    isAuthError,
    onViewAll
}) => {
    // Show top 3 most relevant due problems in the compact popup
    const displayedItems = items.slice(0, 3);

    return (
        <section className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    DUE PROBLEMS
                </span>
                {items.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                        {items.length} {items.length === 1 ? "problem" : "problems"}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="py-3 text-center text-xs text-slate-400 animate-pulse">
                    Loading due problems...
                </div>
            ) : isAuthError ? (
                <div className="py-2 text-center text-xs text-amber-400 font-medium">
                    Sign in to sync your analytics.
                </div>
            ) : error ? (
                <div className="py-2 text-center text-xs text-rose-400 font-medium">
                    {error}
                </div>
            ) : items.length === 0 ? (
                <div className="py-2.5 text-center">
                    <p className="text-xs text-slate-400">No revisions are due today.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {displayedItems.map((item) => (
                        <DueProblemItem key={item.problemId || item.leetcodeId} item={item} />
                    ))}

                    <button
                        type="button"
                        onClick={onViewAll}
                        className="w-full mt-1.5 py-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 hover:border-sky-500/50 rounded transition-colors text-center cursor-pointer"
                    >
                        View All
                    </button>
                </div>
            )}
        </section>
    );
};
