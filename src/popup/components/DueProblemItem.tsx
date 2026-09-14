import React from "react";
import type { DueProblemItemData } from "../../domain/revision/RevisionQueueTypes";

interface DueProblemItemProps {
    item: DueProblemItemData;
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

    return (
        <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/50 space-y-1">
            <div className="flex items-start justify-between gap-1.5">
                <h3 className="text-xs font-medium text-slate-200 line-clamp-1">
                    {item.problemTitle}
                </h3>
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
