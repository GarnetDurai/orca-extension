import { ACTIVE_SESSION_KEY } from "../config/dashboardConfig";
import type { ActiveProblemSession } from "../domain/session/ActiveProblemSession";

export class ActiveSessionService {
    public static async getActiveSession(): Promise<ActiveProblemSession | null> {
        try {
            if (typeof chrome === "undefined" || !chrome.storage?.local) {
                return null;
            }

            // 1. Try querying active tab first if it's on LeetCode
            if (chrome.tabs?.query && chrome.tabs?.sendMessage) {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const activeTab = tabs && tabs[0];
                if (activeTab?.id && activeTab.url && activeTab.url.includes("leetcode.com/problems/")) {
                    try {
                        const response = await chrome.tabs.sendMessage(activeTab.id, { type: "GET_ACTIVE_SESSION" });
                        if (response && response.active && response.session) {
                            return response.session as ActiveProblemSession;
                        }
                    } catch {
                        // Content script may not be ready or active; proceed to storage check
                    }
                }
            }

            // 2. Fall back to chrome.storage.local
            const stored = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
            const session = stored[ACTIVE_SESSION_KEY] as ActiveProblemSession | undefined;
            if (session && session.title && session.sessionStartedAt) {
                // Ignore stale sessions older than 24 hours
                if (Date.now() - session.sessionStartedAt > 24 * 60 * 60 * 1000) {
                    await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
                    return null;
                }
                return session;
            }

            return null;
        } catch {
            return null;
        }
    }
}
