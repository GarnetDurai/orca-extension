import { AUTH_TOKEN_KEY, getDashboardConfig } from "../config/dashboardConfig";

export interface DashboardCodeResponse {
    code: string | null;
    error: string | null;
    status: number | null;
}

export class DashboardAuthApiService {
    public static async requestDashboardCode(): Promise<DashboardCodeResponse> {
        let token: string | null = null;
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                const stored = await chrome.storage.local.get(AUTH_TOKEN_KEY);
                token = (stored[AUTH_TOKEN_KEY] as string) || null;
            }
        } catch {
            return { code: null, error: "Unable to read authentication credentials.", status: 401 };
        }

        if (!token) {
            return { code: null, error: "Authentication required to open dashboard.", status: 401 };
        }

        try {
            const config = await getDashboardConfig();
            const response = await fetch(`${config.backendUrl}/auth/dashboard-code`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    return { code: null, error: "Session expired. Please sign in again.", status: response.status };
                }
                return { code: null, error: "Failed to generate dashboard access code.", status: response.status };
            }

            const data = await response.json();
            if (!data || !data.code || typeof data.code !== "string") {
                return { code: null, error: "Invalid response from authorization server.", status: 502 };
            }

            return { code: data.code, error: null, status: 200 };
        } catch {
            return { code: null, error: "Unable to connect to dashboard server.", status: null };
        }
    }
}
