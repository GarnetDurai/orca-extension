import type { ProblemSession } from "../../domain/session/ProblemSession";

const BACKEND_BASE_URL = "http://localhost:8080";
const SESSIONS_ENDPOINT = `${BACKEND_BASE_URL}/sessions`;
const AUTH_TOKEN_KEY = "authToken";

export interface SessionUploadResult {
    success: boolean;
    status?: number;
    sessionId: string;
    message?: string;
}

export class SessionApiClient {
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
     * Uploads a completed ProblemSession and its events to the backend POST /sessions endpoint.
     */
    public static async uploadSession(session: ProblemSession): Promise<SessionUploadResult> {
        console.log("[DSA Tracker] Uploading completed session");
        console.log(`[DSA Tracker] Session ID: ${session.sessionId}`);
        console.log(`[DSA Tracker] Problem: ${session.problem.title} (#${session.problem.leetcodeId})`);
        console.log(`[DSA Tracker] Attempts: ${session.attempts}`);
        console.log(`[DSA Tracker] Events: ${session.events.length}`);

        const token = await this.getAuthToken();
        if (!token) {
            console.warn(
                "[DSA Tracker] No authentication token found in chrome.storage.local. " +
                "Session will not be uploaded. Please authenticate."
            );
            return {
                success: false,
                sessionId: session.sessionId,
                message: "No authentication token found in chrome.storage.local"
            };
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
                const responseData = await response.json().catch(() => ({}));
                console.log("[DSA Tracker] Session successfully persisted to backend (201 Created):", responseData);
                return {
                    success: true,
                    status: 201,
                    sessionId: session.sessionId
                };
            }

            if (response.status === 409) {
                console.warn(`[DSA Tracker] Session ${session.sessionId} was already uploaded (409 Conflict).`);
                return {
                    success: false,
                    status: 409,
                    sessionId: session.sessionId,
                    message: "Duplicate session ID"
                };
            }

            if (response.status === 401) {
                console.error("[DSA Tracker] Upload failed: 401 Unauthorized. Invalid or expired token.");
                return {
                    success: false,
                    status: 401,
                    sessionId: session.sessionId,
                    message: "Unauthorized (invalid or expired JWT token)"
                };
            }

            if (response.status === 400) {
                const errorBody = await response.text().catch(() => "");
                console.error("[DSA Tracker] Upload failed: 400 Bad Request. Validation error:", errorBody);
                return {
                    success: false,
                    status: 400,
                    sessionId: session.sessionId,
                    message: `Validation error: ${errorBody}`
                };
            }

            if (response.status === 404) {
                console.error("[DSA Tracker] Upload failed: 404 Not Found (User or Problem not found).");
                return {
                    success: false,
                    status: 404,
                    sessionId: session.sessionId,
                    message: "Resource not found on backend"
                };
            }

            console.error(`[DSA Tracker] Upload failed with HTTP status ${response.status}`);
            return {
                success: false,
                status: response.status,
                sessionId: session.sessionId,
                message: `Server returned HTTP ${response.status}`
            };

        } catch (error) {
            console.error("[DSA Tracker] Failed to connect to backend server at " + SESSIONS_ENDPOINT + ":", error);
            return {
                success: false,
                sessionId: session.sessionId,
                message: error instanceof Error ? error.message : "Network error"
            };
        }
    }

    /**
     * Retrieves the list of problem sessions belonging to the currently authenticated user.
     */
    public static async getSessions(): Promise<unknown[] | null> {
        const token = await this.getAuthToken();
        if (!token) {
            console.warn("[DSA Tracker] Cannot fetch sessions: No auth token found.");
            return null;
        }

        try {
            const response = await fetch(SESSIONS_ENDPOINT, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                return (await response.json()) as unknown[];
            }

            console.error(`[DSA Tracker] Failed to fetch sessions: HTTP ${response.status}`);
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
        const token = await this.getAuthToken();
        if (!token) {
            console.warn("[DSA Tracker] Cannot fetch session: No auth token found.");
            return null;
        }

        try {
            const response = await fetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                return await response.json();
            }

            console.error(`[DSA Tracker] Failed to fetch session ${sessionId}: HTTP ${response.status}`);
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
        const token = await this.getAuthToken();
        if (!token) {
            console.warn("[DSA Tracker] Cannot fetch session analytics: No auth token found.");
            return null;
        }

        try {
            const response = await fetch(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}/analytics`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                return await response.json();
            }

            console.error(`[DSA Tracker] Failed to fetch analytics for session ${sessionId}: HTTP ${response.status}`);
            return null;
        } catch (error) {
            console.error(`[DSA Tracker] Error fetching analytics for session ${sessionId}:`, error);
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
