import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionApiClient } from "../content/api/SessionApiClient";
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../config/dashboardConfig";
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

describe("SessionApiClient", () => {
    let mockStorage: Record<string, unknown> = {};

    beforeEach(() => {
        mockStorage = {};
        vi.restoreAllMocks();

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

    it("1. Upload with valid access token returns 201 success", async () => {
        mockStorage[AUTH_TOKEN_KEY] = "valid-access-jwt";

        global.fetch = vi.fn().mockResolvedValue({
            status: 201,
            json: async () => ({ id: 1 })
        });

        const session = createMockSession("sess-1");
        const result = await SessionApiClient.uploadSession(session);

        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost:8080/sessions",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Authorization: "Bearer valid-access-jwt"
                })
            })
        );
    });

    it("2. 401 response triggers refresh and retries upload once with new access token", async () => {
        mockStorage[AUTH_TOKEN_KEY] = "expired-jwt";
        mockStorage[REFRESH_TOKEN_KEY] = "valid-refresh-token";

        const fetchMock = vi.fn()
            // First upload call returns 401
            .mockResolvedValueOnce({
                status: 401
            })
            // Refresh call returns 200 with new tokens
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    token: "new-rotated-jwt",
                    refreshToken: "new-rotated-refresh-token"
                })
            })
            // Retry upload call returns 201
            .mockResolvedValueOnce({
                status: 201,
                json: async () => ({ id: 1 })
            });

        global.fetch = fetchMock;

        const session = createMockSession("sess-2");
        const result = await SessionApiClient.uploadSession(session);

        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
        expect(fetchMock).toHaveBeenCalledTimes(3);

        // Verify storage was updated with rotated tokens
        expect(mockStorage[AUTH_TOKEN_KEY]).toBe("new-rotated-jwt");
        expect(mockStorage[REFRESH_TOKEN_KEY]).toBe("new-rotated-refresh-token");
    });

    it("3. Invalid refresh token (401/400) clears credentials and returns failure with queued: true", async () => {
        mockStorage[AUTH_TOKEN_KEY] = "expired-jwt";
        mockStorage[REFRESH_TOKEN_KEY] = "invalid-refresh-token";

        global.fetch = vi.fn()
            .mockResolvedValueOnce({ status: 401 }) // Upload 401
            .mockResolvedValueOnce({ status: 401, ok: false }); // Refresh 401

        const session = createMockSession("sess-3");
        const result = await SessionApiClient.uploadSession(session);

        expect(result.success).toBe(false);
        expect(result.status).toBe(401);
        expect(result.queued).toBe(true);
        expect(result.authRequired).toBe(true);

        // Verify tokens were purged from storage
        expect(mockStorage[AUTH_TOKEN_KEY]).toBeUndefined();
        expect(mockStorage[REFRESH_TOKEN_KEY]).toBeUndefined();
    });

    it("4. Temporary network or 5xx error during refresh preserves credentials", async () => {
        mockStorage[AUTH_TOKEN_KEY] = "expired-jwt";
        mockStorage[REFRESH_TOKEN_KEY] = "valid-refresh-token";

        global.fetch = vi.fn()
            .mockResolvedValueOnce({ status: 401 }) // Upload 401
            .mockResolvedValueOnce({ status: 500, ok: false }); // Refresh 500

        const session = createMockSession("sess-4");
        const result = await SessionApiClient.uploadSession(session);

        expect(result.success).toBe(false);
        expect(result.queued).toBe(true);

        // Refresh token must NOT be purged on 500
        expect(mockStorage[REFRESH_TOKEN_KEY]).toBe("valid-refresh-token");
    });

    it("5. Single-flight refresh lock: concurrent refreshAccessToken calls share single network call", async () => {
        mockStorage[REFRESH_TOKEN_KEY] = "refresh-token-single-flight";

        let refreshFetchCalls = 0;
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("/auth/refresh")) {
                refreshFetchCalls++;
                await new Promise((r) => setTimeout(r, 20));
                return {
                    ok: true,
                    json: async () => ({ token: "coalesced-jwt", refreshToken: "rotated-ref" })
                };
            }
            return { status: 404 };
        });

        const [t1, t2] = await Promise.all([
            SessionApiClient.refreshAccessToken(),
            SessionApiClient.refreshAccessToken()
        ]);

        expect(refreshFetchCalls).toBe(1);
        expect(t1).toBe("coalesced-jwt");
        expect(t2).toBe("coalesced-jwt");
    });
});
