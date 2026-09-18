import type { ProblemSession } from "../../domain/session/ProblemSession";
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../../config/dashboardConfig";

const BACKEND_BASE_URL = "http://localhost:8080";
const SESSIONS_ENDPOINT = `${BACKEND_BASE_URL}/sessions`;
const REFRESH_ENDPOINT = `${BACKEND_BASE_URL}/auth/refresh`;

export interface SessionUploadResult {
    success: boolean;
    status?: number;
    sessionId: string;
    message?: string;
    queued?: boolean;
    authRequired?: boolean;
    networkError?: boolean;
}

export class SessionApiClient {
    private static activeRefreshPromise: Promise<string | null> | null = null;

    /**
     * Retrieves the stored JWT authentication token from chrome.storage.local.
     */
    public static async getAuthToken(): Promise<string | null> {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                const data = await chrome.storage.local.get([AUTH_TOKEN_KEY, "token", "jwt_token"]);
                const val = (data[AUTH_TOKEN_KEY] || data.token || data.jwt_token) as unknown;
                return typeof val === "string" ? val : null;
            }
        } catch (err) {
            console.warn("[DSA Tracker] Error reading auth token from chrome.storage.local:", err);
        }
        return null;
    }

    /**
     * Retrieves the stored refresh token from chrome.storage.local.
     */
    public static async getRefreshToken(): Promise<string | null> {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                const data = await chrome.storage.local.get(REFRESH_TOKEN_KEY);
                const val = data[REFRESH_TOKEN_KEY] as unknown;
                return typeof val === "string" ? val : null;
            }
        } catch (err) {
            console.warn("[DSA Tracker] Error reading refresh token from chrome.storage.local:", err);
        }
        return null;
    }

    /**
     * Updates authentication tokens in chrome.storage.local.
     */
    public static async setAuthTokens(accessToken: string, refreshToken?: string): Promise<void> {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                const update: Record<string, string> = { [AUTH_TOKEN_KEY]: accessToken };
                if (refreshToken) {
                    update[REFRESH_TOKEN_KEY] = refreshToken;
                }
                await chrome.storage.local.set(update);
            }
        } catch (err) {
            console.error("[DSA Tracker] Error storing auth tokens:", err);
        }
    }

    /**
     * Clears authentication credentials from storage (called on invalid refresh token).
     */
    public static async clearAuthTokens(): Promise<void> {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                await chrome.storage.local.remove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY]);
            }
        } catch (err) {
            console.warn("[DSA Tracker] Error clearing auth tokens:", err);
        }
    }

    /**
     * Refreshes the short-lived access token using the stored refresh token.
     * Guaranteed single-flight: concurrent requests share the exact same refresh Promise.
     */
    public static async refreshAccessToken(): Promise<string | null> {
        if (this.activeRefreshPromise) {
            return this.activeRefreshPromise;
        }

        this.activeRefreshPromise = (async () => {
            const refreshToken = await this.getRefreshToken();
            if (!refreshToken) {
                console.warn("[DSA Tracker] Cannot refresh access token: No refresh token found.");
                return null;
            }

            try {
                const response = await fetch(REFRESH_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ refreshToken })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.token) {
                        await this.setAuthTokens(data.token, data.refreshToken);
                        console.log("[DSA Tracker] Access token refreshed and strictly rotated successfully.");
                        return data.token as string;
                    }
                }

                // 401 or 400: Invalid, expired, or revoked refresh token -> Authentication Failure
                if (response.status === 401 || response.status === 400) {
                    console.warn(
                        `[DSA Tracker] Refresh token rejected (HTTP ${response.status}). User must re-authenticate.`
                    );
                    await this.clearAuthTokens();
                    return null;
                }

                // 5xx or other status: Temporary server error -> Keep existing credentials
                console.warn(`[DSA Tracker] Refresh token request failed with HTTP ${response.status}. Keeping credentials.`);
                return null;
            } catch (error) {
                // Network failure / timeout -> Keep existing credentials
                console.error("[DSA Tracker] Network error during token refresh. Keeping credentials:", error);
                return null;
            } finally {
                this.activeRefreshPromise = null;
            }
        })();

        return this.activeRefreshPromise;
    }

    /**
     * Uploads a completed ProblemSession to the backend POST /sessions endpoint.
     * Responsible strictly for uploading ONE session with at most one refresh attempt and one retry.
     * Note: This method MUST NOT automatically trigger queue flushes.
     */
    public static async uploadSession(
        session: ProblemSession,
        isRetry = false
    ): Promise<SessionUploadResult> {
        console.log(`[DSA Tracker] Uploading session: ${session.sessionId} (Problem #${session.problem.leetcodeId})`);

        let token = await this.getAuthToken();

        // If no access token, attempt refresh first before giving up
        if (!token) {
            token = await this.refreshAccessToken();
            if (!token) {
                console.warn("[DSA Tracker] No valid auth token available. Session will need to be queued.");
                return {
                    success: false,
                    sessionId: session.sessionId,
                    message: "No authentication credentials found",
                    queued: true,
                    authRequired: true
                };
            }
        }

        const payload = this.buildPayload(session);

        try {
            const response = await fetch(SESSIONS_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 201) {
                console.log("[DSA Tracker] Session successfully persisted to backend (201 Created):", session.sessionId);
                return {
                    success: true,
                    status: 201,
                    sessionId: session.sessionId
                };
            }

            if (response.status === 409) {
                console.warn(`[DSA Tracker] Session ${session.sessionId} already exists on backend (409 Conflict).`);
                return {
                    success: true,
                    status: 409,
                    sessionId: session.sessionId,
                    message: "Duplicate session ID"
                };
            }

            if (response.status === 401) {
                if (!isRetry) {
                    console.log("[DSA Tracker] Received 401. Attempting token refresh and upload retry...");
                    const newToken = await this.refreshAccessToken();
                    if (newToken) {
                        return await this.uploadSession(session, true);
                    }
                    return {
                        success: false,
                        status: 401,
                        sessionId: session.sessionId,
                        message: "Authentication expired and refresh failed",
                        queued: true,
                        authRequired: true
                    };
                }

                console.error("[DSA Tracker] Upload failed with 401 Unauthorized after retry.");
                return {
                    success: false,
                    status: 401,
                    sessionId: session.sessionId,
                    message: "Unauthorized after retry",
                    queued: true,
                    authRequired: true
                };
            }

            console.error(`[DSA Tracker] Upload failed with HTTP status ${response.status}`);
            return {
                success: false,
                status: response.status,
                sessionId: session.sessionId,
                message: `Server returned HTTP ${response.status}`,
                queued: true
            };
        } catch (error) {
            console.error("[DSA Tracker] Network failure connecting to " + SESSIONS_ENDPOINT + ":", error);
            return {
                success: false,
                sessionId: session.sessionId,
                message: error instanceof Error ? error.message : "Network error",
                queued: true,
                networkError: true
            };
        }
    }

    /**
     * Retrieves the list of problem sessions belonging to the currently authenticated user.
     */
    public static async getSessions(): Promise<unknown[] | null> {
        let token = await this.getAuthToken();
        if (!token) {
            token = await this.refreshAccessToken();
            if (!token) return null;
        }

        try {
            let response = await fetch(SESSIONS_ENDPOINT, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.status === 401) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    response = await fetch(SESSIONS_ENDPOINT, {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${newToken}` }
                    });
                }
            }

            if (response.ok) {
                return (await response.json()) as unknown[];
            }
            return null;
        } catch (error) {
            console.error("[DSA Tracker] Error fetching sessions from backend:", error);
            return null;
        }
    }

    /**
     * Retrieves a single problem session by its unique sessionId for the authenticated user.
     */
    public static async getSessionById(sessionId: string): Promise<unknown | null> {
        let token = await this.getAuthToken();
        if (!token) {
            token = await this.refreshAccessToken();
            if (!token) return null;
        }

        try {
            let response = await fetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.status === 401) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    response = await fetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`, {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${newToken}` }
                    });
                }
            }

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error(`[DSA Tracker] Error fetching session ${sessionId} from backend:`, error);
            return null;
        }
    }

    /**
     * Retrieves deterministic analytics for a single session.
     */
    public static async getSessionAnalytics(sessionId: string): Promise<unknown | null> {
        let token = await this.getAuthToken();
        if (!token) {
            token = await this.refreshAccessToken();
            if (!token) return null;
        }

        try {
            let response = await fetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}/analytics`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.status === 401) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    response = await fetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}/analytics`, {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${newToken}` }
                    });
                }
            }

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error(`[DSA Tracker] Error fetching analytics for session ${sessionId}:`, error);
            return null;
        }
    }

    /**
     * Retrieves historical deterministic analytics across all completed sessions.
     */
    public static async getHistoricalAnalytics(timeWindow?: string): Promise<unknown | null> {
        let token = await this.getAuthToken();
        if (!token) {
            token = await this.refreshAccessToken();
            if (!token) return null;
        }

        try {
            const query = timeWindow ? `?timeWindow=${encodeURIComponent(timeWindow)}` : "";
            let response = await fetch(`${BACKEND_BASE_URL}/analytics/historical${query}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.status === 401) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    response = await fetch(`${BACKEND_BASE_URL}/analytics/historical${query}`, {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${newToken}` }
                    });
                }
            }

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error("[DSA Tracker] Error fetching historical analytics from backend:", error);
            return null;
        }
    }

    /**
     * Retrieves the on-demand user performance profile.
     */
    public static async getUserProfile(): Promise<unknown | null> {
        let token = await this.getAuthToken();
        if (!token) {
            token = await this.refreshAccessToken();
            if (!token) return null;
        }

        try {
            let response = await fetch(`${BACKEND_BASE_URL}/analytics/profile`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.status === 401) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    response = await fetch(`${BACKEND_BASE_URL}/analytics/profile`, {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${newToken}` }
                    });
                }
            }

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error("[DSA Tracker] Error fetching user profile from backend:", error);
            return null;
        }
    }

    /**
     * Converts a ProblemSession domain object to the backend ProblemSessionRequestDTO schema.
     */
    private static buildPayload(session: ProblemSession): Record<string, unknown> {
        return {
            sessionId: session.sessionId,
            problem: {
                leetcodeId: session.problem.leetcodeId,
                title: session.problem.title,
                difficulty: session.problem.difficulty,
                url: session.problem.url,
                slug: session.problem.slug
            },
            sessionStartedAt: session.sessionStartedAt,
            firstCodingAt: session.firstCodingAt,
            solvedAt: session.solvedAt,
            thinkingDuration: session.thinkingDuration,
            codingDuration: session.codingDuration,
            totalTimeAway: session.totalTimeAway,
            tabSwitchCount: session.tabSwitchCount,
            language: session.language,
            hintOpened: session.hintOpened,
            hintOpenCount: session.hintOpenCount,
            hintOpenedAt: session.hintOpenedAt,
            solutionViewed: session.solutionViewed,
            solutionViewedAt: session.solutionViewedAt,
            editorialViewed: session.editorialViewed,
            editorialViewedAt: session.editorialViewedAt,
            attempts: session.attempts,
            solved: session.solved,
            events: session.events.map((evt) => ({
                type: evt.type,
                timestamp: evt.timestamp,
                result: evt.result,
                submissionId: evt.submissionId,
                hintName: evt.hintName
            }))
        };
    }
}
