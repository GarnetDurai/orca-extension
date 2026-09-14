import React from "react";

interface PopupHeaderProps {
    userEmail: string | null;
    onSignOut: () => void;
    onSignInClick: () => void;
}

export const PopupHeader: React.FC<PopupHeaderProps> = ({
    userEmail,
    onSignOut,
    onSignInClick
}) => {
    return (
        <header className="flex items-center justify-between pb-3 border-b border-slate-700/80 mb-3">
            <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                    <h1 className="text-sm font-bold text-slate-100 tracking-tight">
                        DSA Tracker
                    </h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-slate-400">Tracking Active</span>
                    </div>
                </div>
            </div>

            <div className="text-right">
                {userEmail ? (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {userEmail}
                        </span>
                        <button
                            type="button"
                            onClick={onSignOut}
                            className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                        >
                            Sign out
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onSignInClick}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                    >
                        Sign in
                    </button>
                )}
            </div>
        </header>
    );
};
