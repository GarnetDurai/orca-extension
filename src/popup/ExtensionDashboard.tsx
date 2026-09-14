import React, { useState, useEffect } from "react";
import { PopupHeader } from "./components/PopupHeader";
import { CurrentProblemCard } from "./components/CurrentProblemCard";
import { TodaySummary } from "./components/TodaySummary";
import { DueProblemsList } from "./components/DueProblemsList";
import { OpenDashboardButton } from "./components/OpenDashboardButton";
import { AuthView } from "./components/AuthView";
import { useActiveSession } from "../hooks/useActiveSession";
import { useTodayWorkload } from "../hooks/useTodayWorkload";
import {
    AUTH_TOKEN_KEY,
    USER_EMAIL_KEY,
    getDashboardConfig
} from "../config/dashboardConfig";

export const ExtensionDashboard: React.FC = () => {
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const { session, formattedTime, loading: sessionLoading } = useActiveSession();
    const { workload, loading: workloadLoading, error: workloadError, isAuthError, refetch } = useTodayWorkload();

    // Check stored user email on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (typeof chrome !== "undefined" && chrome.storage?.local) {
                    const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
                    if (stored[AUTH_TOKEN_KEY] && stored[USER_EMAIL_KEY]) {
                        setUserEmail(stored[USER_EMAIL_KEY] as string);
                    } else {
                        setUserEmail(null);
                    }
                }
            } catch {
                setUserEmail(null);
            }
        };
        checkAuth();
    }, []);

    const handleSignOut = async () => {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                await chrome.storage.local.remove([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
            }
        } catch {
            // Ignore error
        }
        setUserEmail(null);
        refetch();
    };

    const handleAuthSuccess = (email: string) => {
        setUserEmail(email);
        refetch();
    };

    const handleOpenOverview = async () => {
        const config = await getDashboardConfig();
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
            chrome.tabs.create({ url: config.overviewUrl });
        } else {
            window.open(config.overviewUrl, "_blank");
        }
    };

    const handleOpenRevisions = async () => {
        const config = await getDashboardConfig();
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
            chrome.tabs.create({ url: config.revisionsUrl });
        } else {
            window.open(config.revisionsUrl, "_blank");
        }
    };

    if (!userEmail) {
        return <AuthView onAuthSuccess={handleAuthSuccess} />;
    }

    return (
        <div className="w-[340px] p-3.5 bg-slate-900 text-slate-100 font-sans select-none">
            <PopupHeader
                userEmail={userEmail}
                onSignOut={handleSignOut}
                onSignInClick={() => {}}
            />

            <main className="space-y-3">
                {/* 1. CURRENT PROBLEM */}
                <CurrentProblemCard
                    session={session}
                    formattedTime={formattedTime}
                    loading={sessionLoading}
                />

                {/* 2. TODAY */}
                <TodaySummary
                    workload={workload}
                    loading={workloadLoading}
                    error={workloadError}
                    isAuthError={isAuthError}
                />

                {/* 3. DUE PROBLEMS */}
                <DueProblemsList
                    items={workload?.queue || []}
                    loading={workloadLoading}
                    error={workloadError}
                    isAuthError={isAuthError}
                    onViewAll={handleOpenRevisions}
                />

                {/* 4. OPEN DASHBOARD */}
                <div className="pt-1">
                    <OpenDashboardButton onOpenDashboard={handleOpenOverview} />
                </div>
            </main>
        </div>
    );
};
