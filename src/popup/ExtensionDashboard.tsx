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
    REFRESH_TOKEN_KEY,
    USER_EMAIL_KEY,
    getDashboardConfig
} from "../config/dashboardConfig";
import { SessionQueueService } from "../services/sessionQueueService";

export const ExtensionDashboard: React.FC = () => {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [ssoError, setSsoError] = useState<string | null>(null);
    const [ssoLoading, setSsoLoading] = useState<boolean>(false);

    const { session, formattedTime, loading: sessionLoading } = useActiveSession();
    const { workload, loading: workloadLoading, error: workloadError, isAuthError, refetch } = useTodayWorkload();

    // Check stored user email on mount and attempt safe queue flush
    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (typeof chrome !== "undefined" && chrome.storage?.local) {
                    const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
                    if (stored[AUTH_TOKEN_KEY] && stored[USER_EMAIL_KEY]) {
                        setUserEmail(stored[USER_EMAIL_KEY] as string);
                        // Trigger safe queue flush upon opening popup if authenticated
                        SessionQueueService.flushPendingSessions().catch(() => {});
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
                await chrome.storage.local.remove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_EMAIL_KEY]);
            }
        } catch {
            // Ignore error
        }
        setUserEmail(null);
        setSsoError(null);
        refetch();
    };

    const handleAuthSuccess = (email: string) => {
        setUserEmail(email);
        setSsoError(null);
        refetch();
    };

    const handleOpenOverview = async () => {
        if (ssoLoading) return;
        setSsoError(null);
        setSsoLoading(true);

        try {
            const { DashboardAuthApiService } = await import("../services/dashboardAuthApiService");
            const result = await DashboardAuthApiService.requestDashboardCode();

            if (!result.code) {
                // Per requirement: If code request fails, do NOT open the dashboard URL.
                // Show a safe error message and keep the user in the extension.
                setSsoError(result.error || "Unable to open dashboard.");
                setSsoLoading(false);
                return;
            }

            const config = await getDashboardConfig();
            const targetUrl = `${config.overviewUrl}/dashboard?code=${encodeURIComponent(result.code)}`;

            if (typeof chrome !== "undefined" && chrome.tabs?.create) {
                chrome.tabs.create({ url: targetUrl });
            } else {
                window.open(targetUrl, "_blank");
            }
        } catch {
            setSsoError("Unable to connect to dashboard server.");
        } finally {
            setSsoLoading(false);
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
                <div className="pt-1 space-y-1.5">
                    {ssoError && (
                        <div className="p-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg text-center font-medium">
                            {ssoError}
                        </div>
                    )}
                    <OpenDashboardButton onOpenDashboard={handleOpenOverview} />
                </div>
            </main>
        </div>
    );
};
