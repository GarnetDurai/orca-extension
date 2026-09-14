import React from "react";
import type { ActiveProblemSession } from "../../domain/session/ActiveProblemSession";

interface CurrentProblemCardProps {
    session: ActiveProblemSession | null;
    formattedTime: string;
    loading?: boolean;
}

export const CurrentProblemCard: React.FC<CurrentProblemCardProps> = ({
    session,
    formattedTime,
    loading = false
}) => {
    const getDifficultyColor = (diff?: string) => {
        const d = (diff || "").toUpperCase();
        if (d === "EASY") {
            return "text-emerald-400 bg-emerald-950/60 border-emerald-800/60";
        }
        if (d === "HARD") {
            return "text-rose-400 bg-rose-950/60 border-rose-800/60";
        }
        return "text-amber-400 bg-amber-950/60 border-amber-800/60";
    };

    return (
        <section className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    CURRENT PROBLEM
                </span>
                {session && (
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                    </span>
                )}
            </div>

            {loading ? (
                <div className="py-3 text-center text-xs text-slate-400 animate-pulse">
                    Detecting active problem...
                </div>
            ) : !session ? (
                <div className="py-2.5 text-center">
                    <p className="text-xs text-slate-400 font-medium">No active problem</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        Open a LeetCode problem to start tracking
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                            {session.title}
                        </h2>
                        <span
                            className={`text-[11px] px-2 py-0.5 font-medium rounded border uppercase shrink-0 ${getDifficultyColor(
                                session.difficulty
                            )}`}
                        >
                            {session.difficulty}
                        </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-xs text-slate-300">
                        <div>
                            <span className="text-slate-400">Attempts: </span>
                            <span className="font-semibold text-slate-200">{session.attempts}</span>
                        </div>
                        <div>
                            <span className="text-slate-400">Time: </span>
                            <span className="font-mono font-semibold text-sky-400">{formattedTime}</span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
