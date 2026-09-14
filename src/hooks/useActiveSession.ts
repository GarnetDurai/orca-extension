import { useState, useEffect } from "react";
import { ActiveSessionService } from "../services/activeSessionService";
import { ACTIVE_SESSION_KEY } from "../config/dashboardConfig";
import type { ActiveProblemSession } from "../domain/session/ActiveProblemSession";

export interface UseActiveSessionResult {
    session: ActiveProblemSession | null;
    elapsedSeconds: number;
    formattedTime: string;
    loading: boolean;
    refresh: () => Promise<void>;
}

export function formatDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}

export function useActiveSession(): UseActiveSessionResult {
    const [session, setSession] = useState<ActiveProblemSession | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchSession = async () => {
        const current = await ActiveSessionService.getActiveSession();
        setSession(current);
        if (current && current.sessionStartedAt) {
            const elapsed = Math.max(0, Math.floor((Date.now() - current.sessionStartedAt) / 1000));
            setElapsedSeconds(elapsed);
        } else {
            setElapsedSeconds(0);
        }
        setLoading(false);
    };

    // Initial load
    useEffect(() => {
        fetchSession();

        // Listen for storage changes from content script
        const handleStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === "local" && changes[ACTIVE_SESSION_KEY]) {
                const newValue = changes[ACTIVE_SESSION_KEY].newValue as ActiveProblemSession | undefined;
                if (newValue) {
                    setSession(newValue);
                    const elapsed = Math.max(0, Math.floor((Date.now() - newValue.sessionStartedAt) / 1000));
                    setElapsedSeconds(elapsed);
                } else {
                    setSession(null);
                    setElapsedSeconds(0);
                }
            }
        };

        if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
            chrome.storage.onChanged.addListener(handleStorageChange);
        }

        return () => {
            if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
                chrome.storage.onChanged.removeListener(handleStorageChange);
            }
        };
    }, []);

    // Live timer update every second
    useEffect(() => {
        if (!session || !session.sessionStartedAt) {
            return;
        }

        const intervalId = setInterval(() => {
            const now = Date.now();
            const elapsed = Math.max(0, Math.floor((now - session.sessionStartedAt) / 1000));
            setElapsedSeconds(elapsed);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [session?.sessionStartedAt]);

    return {
        session,
        elapsedSeconds,
        formattedTime: formatDuration(elapsedSeconds),
        loading,
        refresh: fetchSession
    };
}
