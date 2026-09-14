import React from "react";
import type { TodayWorkloadData } from "../../domain/revision/RevisionQueueTypes";

interface TodaySummaryProps {
    workload: TodayWorkloadData | null;
    loading: boolean;
    error: string | null;
    isAuthError: boolean;
}

export const TodaySummary: React.FC<TodaySummaryProps> = ({
    workload,
    loading,
    error,
    isAuthError
}) => {
    return (
        <section className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    TODAY
                </span>
            </div>

            {loading ? (
                <div className="py-3 text-center text-xs text-slate-400 animate-pulse">
                    Loading today's workload...
                </div>
            ) : isAuthError ? (
                <div className="py-2 text-center text-xs text-amber-400 font-medium">
                    Sign in to sync your analytics.
                </div>
            ) : error ? (
                <div className="py-2 text-center text-xs text-rose-400 font-medium">
                    {error}
                </div>
            ) : !workload ? (
                <div className="py-2 text-center text-xs text-slate-400">
                    No workload data available.
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                        <span className="text-[11px] text-slate-400 block">Due problems</span>
                        <span className="text-sm font-semibold text-slate-100">
                            {workload.totalDue}
                        </span>
                    </div>

                    <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                        <span className="text-[11px] text-slate-400 block">Review capacity</span>
                        <span className="text-sm font-semibold text-slate-100">
                            {workload.dailyCapacity}
                        </span>
                    </div>

                    <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                        <span className="text-[11px] text-slate-400 block">Reviews</span>
                        <span className="text-sm font-semibold text-slate-100">
                            {workload.reviewsCompletedToday} / {workload.dailyCapacity}
                        </span>
                    </div>

                    <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                        <span className="text-[11px] text-slate-400 block">New solved</span>
                        <span className="text-sm font-semibold text-slate-100">
                            {workload.newProblemsSolvedToday}
                        </span>
                    </div>
                </div>
            )}
        </section>
    );
};
