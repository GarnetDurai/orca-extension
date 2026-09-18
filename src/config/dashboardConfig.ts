export interface DashboardConfig {
    overviewUrl: string;
    revisionsUrl: string;
    backendUrl: string;
}

export const DEFAULT_CONFIG: DashboardConfig = {
    overviewUrl: "http://localhost:5173",
    revisionsUrl: "http://localhost:5173/revisions",
    backendUrl: "http://localhost:8080"
};

export const AUTH_TOKEN_KEY = "authToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const PENDING_SESSIONS_QUEUE_KEY = "pendingSessionsQueue";
export const USER_EMAIL_KEY = "userEmail";
export const ACTIVE_SESSION_KEY = "activeProblemSession";
export const DASHBOARD_CONFIG_KEY = "dashboardConfig";

export async function getDashboardConfig(): Promise<DashboardConfig> {
    try {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
            const stored = await chrome.storage.local.get(DASHBOARD_CONFIG_KEY);
            if (stored && stored[DASHBOARD_CONFIG_KEY]) {
                return { ...DEFAULT_CONFIG, ...stored[DASHBOARD_CONFIG_KEY] };
            }
        }
    } catch {
        // Fallback to default
    }
    return DEFAULT_CONFIG;
}
