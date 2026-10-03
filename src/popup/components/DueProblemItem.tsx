import React from "react";
import type { DueProblemItemData } from "../../domain/revision/RevisionQueueTypes";

interface DueProblemItemProps {
    item: DueProblemItemData;
}

/**
 * Builds the canonical LeetCode URL for a problem.
 * Prefers the problem slug (https://leetcode.com/problems/{slug}/).
 * Gracefully falls back to numeric ID if no slug is available.
 * Returns null if neither is available.
 */
export function getLeetcodeProblemUrl(slug?: string, id?: number): string | null {
    if (slug && slug.trim()) {
        return `https://leetcode.com/problems/${slug.trim()}/`;
    }
    if (id != null && !isNaN(id) && id > 0) {
        return `https://leetcode.com/problems/${id}/`;
    }
    return null;
}

export const DueProblemItem: React.FC<DueProblemItemProps> = ({ item }) => {
    // Format overdue text if applicable
    const getOverdueText = () => {
        if (item.overdueDays && item.overdueDays >= 1.0) {
            const days = Math.floor(item.overdueDays);
            return `Overdue: ${days} ${days === 1 ? "day" : "days"}`;
        }
        if (item.nextReviewAt) {
            const reviewDate = new Date(item.nextReviewAt);
            if (reviewDate.getTime() < Date.now()) {
                const diffHours = (Date.now() - reviewDate.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 24) {
                    const days = Math.floor(diffHours / 24);
                    return `Overdue: ${days} ${days === 1 ? "day" : "days"}`;
                }
                return "Overdue: Today";
            }
        }
        return null;
    };

    const overdueText = getOverdueText();
    const openUrl = getLeetcodeProblemUrl(item.leetcodeSlug, item.leetcodeId);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!openUrl) return;
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
            chrome.tabs.create({ url: openUrl });
        } else {
            window.open(openUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/50 space-y-1.5">
            <div className="flex items-start justify-between gap-1.5">
                <h3 className="text-xs font-medium text-slate-200 line-clamp-1">
                    {item.problemTitle}
                </h3>
                {openUrl && (
                    <button
                        type="button"
                        onClick={handleOpen}
                        aria-label={`Open ${item.problemTitle} on LeetCode`}
                        className="px-2 py-0.5 text-[10px] font-medium rounded bg-sky-950/60 text-sky-400 hover:text-sky-300 border border-sky-800/60 hover:bg-sky-900/60 transition-colors shrink-0 cursor-pointer"
                    >
                        Open
                    </button>
                )}
            </div>

            <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                    Confidence: <span className="font-semibold text-sky-400">{item.currentConfidence}</span>
                </span>
                {overdueText && (
                    <span className="text-rose-400 font-medium text-[11px] bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/50">
                        {overdueText}
                    </span>
                )}
            </div>
        </div>
    );
};
