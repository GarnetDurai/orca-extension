import { PENDING_SESSIONS_QUEUE_KEY } from "../config/dashboardConfig";
import type { ProblemSession } from "../domain/session/ProblemSession";
import { SessionApiClient } from "../content/api/SessionApiClient";

export interface FlushSummary {
    attempted: number;
    succeeded: number;
    failed: number;
}

export class SessionQueueService {
    private static activeFlushPromise: Promise<FlushSummary> | null = null;

    /**
     * Retrieves all pending problem sessions from chrome.storage.local.
     */
    public static async getPendingSessions(): Promise<ProblemSession[]> {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                const data = await chrome.storage.local.get(PENDING_SESSIONS_QUEUE_KEY);
                const list = data[PENDING_SESSIONS_QUEUE_KEY];
                if (Array.isArray(list)) {
                    return list as ProblemSession[];
                }
            }
        } catch (err) {
            console.warn("[DSA Tracker] Error reading pending sessions queue:", err);
        }
        return [];
    }

    /**
     * Persists a session into the pending queue, preventing duplicate sessionIds.
     */
    public static async queueSession(session: ProblemSession): Promise<void> {
        try {
            if (typeof chrome === "undefined" || !chrome.storage?.local) {
                return;
            }

            const sessions = await this.getPendingSessions();
            const existingIndex = sessions.findIndex((s) => s.sessionId === session.sessionId);

            if (existingIndex >= 0) {
                // Update existing record
                sessions[existingIndex] = session;
            } else {
                // Append new record
                sessions.push(session);
            }

            await chrome.storage.local.set({ [PENDING_SESSIONS_QUEUE_KEY]: sessions });
            console.log(`[DSA Tracker] Session ${session.sessionId} successfully queued. Total pending: ${sessions.length}`);
        } catch (err) {
            console.error("[DSA Tracker] Error queueing session:", err);
        }
    }

    /**
     * Removes a session from the pending queue by its sessionId.
     */
    public static async removeSession(sessionId: string): Promise<void> {
        try {
            if (typeof chrome === "undefined" || !chrome.storage?.local) {
                return;
            }

            const sessions = await this.getPendingSessions();
            const filtered = sessions.filter((s) => s.sessionId !== sessionId);
            await chrome.storage.local.set({ [PENDING_SESSIONS_QUEUE_KEY]: filtered });
            console.log(`[DSA Tracker] Session ${sessionId} removed from queue. Remaining: ${filtered.length}`);
        } catch (err) {
            console.warn("[DSA Tracker] Error removing session from queue:", err);
        }
    }

    /**
     * Checks if a session with the given sessionId is in the pending queue.
     */
    public static async hasSession(sessionId: string): Promise<boolean> {
        const sessions = await this.getPendingSessions();
        return sessions.some((s) => s.sessionId === sessionId);
    }

    /**
     * Flushes all pending sessions using single-flight execution.
     * Iterates through the queue, attempting to upload each session once.
     * Stops immediately if the backend is unavailable or authentication fails,
     * leaving the remaining items intact.
     */
    public static async flushPendingSessions(): Promise<FlushSummary> {
        if (this.activeFlushPromise) {
            return this.activeFlushPromise;
        }

        this.activeFlushPromise = (async () => {
            const sessions = await this.getPendingSessions();
            if (sessions.length === 0) {
                return { attempted: 0, succeeded: 0, failed: 0 };
            }

            console.log(`[DSA Tracker] Starting flush of ${sessions.length} pending session(s)...`);
            let succeeded = 0;
            let failed = 0;

            for (const session of sessions) {
                try {
                    const result = await SessionApiClient.uploadSession(session);

                    if (result.success || result.status === 201 || result.status === 409) {
                        await this.removeSession(session.sessionId);
                        succeeded++;
                    } else {
                        failed++;
                        // If auth failed (invalid refresh token) or network/backend is unreachable,
                        // break out of the loop early to avoid tight retry loops against an unavailable backend
                        if (result.status === 401 || result.networkError) {
                            console.warn(
                                "[DSA Tracker] Halting queue flush: backend unavailable or authentication required."
                            );
                            break;
                        }
                    }
                } catch (error) {
                    failed++;
                    console.error("[DSA Tracker] Unexpected error during session flush:", error);
                    break;
                }
            }

            console.log(`[DSA Tracker] Queue flush complete: ${succeeded} succeeded, ${failed} failed.`);
            return { attempted: sessions.length, succeeded, failed };
        })().finally(() => {
            this.activeFlushPromise = null;
        });

        return this.activeFlushPromise;
    }
}
