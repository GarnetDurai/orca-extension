import React from "react";

interface OpenDashboardButtonProps {
    onOpenDashboard: () => void;
}

export const OpenDashboardButton: React.FC<OpenDashboardButtonProps> = ({
    onOpenDashboard
}) => {
    return (
        <button
            type="button"
            onClick={onOpenDashboard}
            className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-medium text-xs rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400/50"
        >
            <span>Open Dashboard</span>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
        </button>
    );
};
