import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionQueueService } from "../services/sessionQueueService";
import { SessionApiClient } from "../content/api/SessionApiClient";
import { PENDING_SESSIONS_QUEUE_KEY } from "../config/dashboardConfig";
import type { ProblemSession } from "../domain/session/ProblemSession";

function createMockSession(sessionId: string): ProblemSession {
    return {
        sessionId,
        problem: {
            leetcodeId: 1,
            title: "Two Sum",
            difficulty: "EASY",
            url: "https://leetcode.com/problems/two-sum/",
            slug: "two-sum"
        },
        sessionStartedAt: 1000,
        firstCodingAt: 1100,
        solvedAt: 2000,
        thinkingDuration: 100,
        codingDuration: 900,
        totalTimeAway: 0,
        tabSwitchCount: 0,
        language: "java",
        hintOpened: false,
        hintOpenCount: 0,
        hintOpenedAt: null,
        solutionViewed: false,
        solutionViewedAt: null,
        editorialViewed: false,
        editorialViewedAt: null,
        attempts: 1,
        events: [],
        solved: true
    };
}

describe("SessionQueueService", () => {
    let mockStorage: Record<string, unknown> = {};

    beforeEach(() => {
        mockStorage = {};
        vi.restoreAllMocks();

        // Setup mock chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: vi.fn().mockImplementation((keys) => {
                        if (typeof keys === "string") {
                            return Promise.resolve({ [keys]: mockStorage[keys] });
                        }
                        if (Array.isArray(keys)) {
                            const res: Record<string, unknown> = {};
                            keys.forEach((k) => (res[k] = mockStorage[k]));
                            return Promise.resolve(res);
                        }
                        return Promise.resolve(mockStorage);
                    }),
                    set: vi.fn().mockImplementation((items) => {
                        Object.assign(mockStorage, items);
                        return Promise.resolve();
                    }),
                    remove: vi.fn().mockImplementation((keys) => {
                        const arr = Array.isArray(keys) ? keys : [keys];
                        arr.forEach((k) => delete mockStorage[k]);
                        return Promise.resolve();
                    })
                }
            }
        } as unknown as typeof chrome;
    });

    it("1. Persists new sessions into pending queue", async () => {
        const session1 = createMockSession("sess-1");
        await SessionQueueService.queueSession(session1);

        const pending = await SessionQueueService.getPendingSessions();
        expect(pending).toHaveLength(1);
        expect(pending[0].sessionId).toBe("sess-1");
    });

    it("2. Deduplicates sessions by updating existing sessionId rather than adding a duplicate", async () => {
        const session1 = createMockSession("sess-1");
        await SessionQueueService.queueSession(session1);

        const session1Updated = { ...session1, attempts: 2 };
        await SessionQueueService.queueSession(session1Updated);

        const pending = await SessionQueueService.getPendingSessions();
        expect(pending).toHaveLength(1);
        expect(pending[0].attempts).toBe(2);
    });

    it("3. Removes session from queue by sessionId", async () => {
        const session1 = createMockSession("sess-1");
        const session2 = createMockSession("sess-2");
        await SessionQueueService.queueSession(session1);
        await SessionQueueService.queueSession(session2);

        await SessionQueueService.removeSession("sess-1");

        const pending = await SessionQueueService.getPendingSessions();
        expect(pending).toHaveLength(1);
        expect(pending[0].sessionId).toBe("sess-2");
    });

    it("4. Flushes queue: successful uploads (201/409) are removed from queue", async () => {
        const session1 = createMockSession("sess-1");
        const session2 = createMockSession("sess-2");
        await SessionQueueService.queueSession(session1);
        await SessionQueueService.queueSession(session2);

        vi.spyOn(SessionApiClient, "uploadSession")
            .mockResolvedValueOnce({ success: true, status: 201, sessionId: "sess-1" })
            .mockResolvedValueOnce({ success: true, status: 409, sessionId: "sess-2" });

        const summary = await SessionQueueService.flushPendingSessions();

        expect(summary.attempted).toBe(2);
        expect(summary.succeeded).toBe(2);
        expect(summary.failed).toBe(0);

        const remaining = await SessionQueueService.getPendingSessions();
        expect(remaining).toHaveLength(0);
    });

    it("5. Single-flight flush: concurrent flush calls share the exact same active promise", async () => {
        const session1 = createMockSession("sess-1");
        await SessionQueueService.queueSession(session1);

        let uploadCallCount = 0;
        vi.spyOn(SessionApiClient, "uploadSession").mockImplementation(async () => {
            uploadCallCount++;
            await new Promise((r) => setTimeout(r, 20));
            return { success: true, status: 201, sessionId: "sess-1" };
        });

        // Trigger two concurrent flushes
        const [res1, res2] = await Promise.all([
            SessionQueueService.flushPendingSessions(),
            SessionQueueService.flushPendingSessions()
        ]);

        expect(uploadCallCount).toBe(1);
        expect(res1).toEqual(res2);
    });

    it("6. Halts flush loop early on auth failure or backend unavailability, keeping remaining queue intact", async () => {
        const session1 = createMockSession("sess-1");
        const session2 = createMockSession("sess-2");
        const session3 = createMockSession("sess-3");
        await SessionQueueService.queueSession(session1);
        await SessionQueueService.queueSession(session2);
        await SessionQueueService.queueSession(session3);

        vi.spyOn(SessionApiClient, "uploadSession")
            .mockResolvedValueOnce({ success: true, status: 201, sessionId: "sess-1" })
            .mockResolvedValueOnce({ success: false, status: 401, sessionId: "sess-2", authRequired: true });

        const summary = await SessionQueueService.flushPendingSessions();

        expect(summary.attempted).toBe(3);
        expect(summary.succeeded).toBe(1);
        expect(summary.failed).toBe(1);

        // sess-1 removed, sess-2 and sess-3 remain
        const remaining = await SessionQueueService.getPendingSessions();
        expect(remaining.map((s) => s.sessionId)).toEqual(["sess-2", "sess-3"]);
    });

    it("7. Network error halts flush loop early and preserves all remaining items", async () => {
        const session1 = createMockSession("sess-1");
        const session2 = createMockSession("sess-2");
        await SessionQueueService.queueSession(session1);
        await SessionQueueService.queueSession(session2);

        vi.spyOn(SessionApiClient, "uploadSession")
            .mockResolvedValueOnce({ success: false, sessionId: "sess-1", networkError: true });

        const summary = await SessionQueueService.flushPendingSessions();

        expect(summary.succeeded).toBe(0);
        expect(summary.failed).toBe(1);

        const remaining = await SessionQueueService.getPendingSessions();
        expect(remaining).toHaveLength(2);
    });
});
