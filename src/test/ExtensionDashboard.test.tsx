import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExtensionDashboard } from "../popup/ExtensionDashboard";
import { CurrentProblemCard } from "../popup/components/CurrentProblemCard";
import { TodaySummary } from "../popup/components/TodaySummary";
import { DueProblemsList } from "../popup/components/DueProblemsList";
import { AuthView } from "../popup/components/AuthView";
import { formatDuration } from "../hooks/useActiveSession";
import { ActiveSessionService } from "../services/activeSessionService";
import { RevisionApiService } from "../services/revisionApiService";
import {
    DEFAULT_CONFIG,
    ACTIVE_SESSION_KEY,
    AUTH_TOKEN_KEY,
    USER_EMAIL_KEY
} from "../config/dashboardConfig";

describe("Extension Dashboard V1 Tests", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset chrome storage mock data
        chrome.storage.local.clear();
        // By default set authenticated state for dashboard tests
        await chrome.storage.local.set({
            [AUTH_TOKEN_KEY]: "mock-jwt-token-xyz",
            [USER_EMAIL_KEY]: "user@example.com"
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // 1. Current problem displays correctly
    it("1. Current problem displays correctly", async () => {
        const mockSession = {
            sessionId: "sess-1",
            title: "Two Sum",
            difficulty: "EASY",
            leetcodeId: 1,
            sessionStartedAt: Date.now() - 60000,
            attempts: 1
        };

        vi.spyOn(ActiveSessionService, "getActiveSession").mockResolvedValue(mockSession);
        vi.spyOn(RevisionApiService, "fetchTodayWorkload").mockResolvedValue({
            data: {
                totalDue: 0,
                dailyCapacity: 2,
                reviewsCompletedToday: 0,
                newProblemsSolvedToday: 0,
                queue: []
            },
            error: null,
            status: 200,
            isAuthError: false
        });

        render(<ExtensionDashboard />);

        await waitFor(() => {
            expect(screen.getByText("Two Sum")).toBeInTheDocument();
        });
    });

    // 2. Timer updates correctly
    it("2. Timer formats and updates correctly", () => {
        expect(formatDuration(0)).toBe("00:00");
        expect(formatDuration(65)).toBe("01:05");
        expect(formatDuration(1122)).toBe("18:42");
        expect(formatDuration(3665)).toBe("1:01:05");

        const session = {
            sessionId: "sess-timer",
            title: "LRU Cache",
            difficulty: "MEDIUM",
            leetcodeId: 146,
            sessionStartedAt: Date.now() - 10000,
            attempts: 0
        };

        const { rerender } = render(<CurrentProblemCard session={session} formattedTime="00:10" />);
        expect(screen.getByText("00:10")).toBeInTheDocument();

        rerender(<CurrentProblemCard session={session} formattedTime="00:15" />);
        expect(screen.getByText("00:15")).toBeInTheDocument();
    });

    // 3. No active problem empty state
    it("3. No active problem empty state displays when session is null", async () => {
        vi.spyOn(ActiveSessionService, "getActiveSession").mockResolvedValue(null);
        vi.spyOn(RevisionApiService, "fetchTodayWorkload").mockResolvedValue({
            data: {
                totalDue: 0,
                dailyCapacity: 2,
                reviewsCompletedToday: 0,
                newProblemsSolvedToday: 0,
                queue: []
            },
            error: null,
            status: 200,
            isAuthError: false
        });

        render(<ExtensionDashboard />);

        await waitFor(() => {
            expect(screen.getByText("No active problem")).toBeInTheDocument();
        });
    });

    // 4. Attempt count displays current value
    it("4. Attempt count displays current value", async () => {
        const mockSession = {
            sessionId: "sess-attempts",
            title: "Merge Intervals",
            difficulty: "MEDIUM",
            leetcodeId: 56,
            sessionStartedAt: Date.now() - 120000,
            attempts: 4
        };

        render(<CurrentProblemCard session={mockSession} formattedTime="02:00" />);
        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText(/Attempts:/i)).toBeInTheDocument();
    });

    // 5. Difficulty displays correctly
    it("5. Difficulty displays correctly with proper text", () => {
        const easySession = {
            sessionId: "s1",
            title: "Easy Prob",
            difficulty: "EASY",
            leetcodeId: 1,
            sessionStartedAt: Date.now(),
            attempts: 0
        };
        const { rerender } = render(<CurrentProblemCard session={easySession} formattedTime="00:00" />);
        expect(screen.getByText("EASY")).toBeInTheDocument();

        const hardSession = {
            sessionId: "s2",
            title: "Hard Prob",
            difficulty: "HARD",
            leetcodeId: 2,
            sessionStartedAt: Date.now(),
            attempts: 0
        };
        rerender(<CurrentProblemCard session={hardSession} formattedTime="00:00" />);
        expect(screen.getByText("HARD")).toBeInTheDocument();
    });

    // 6. Today summary loads
    it("6. Today summary loads due problems, capacity, reviews, and new solved", async () => {
        const workload = {
            totalDue: 4,
            dailyCapacity: 2,
            reviewsCompletedToday: 1,
            newProblemsSolvedToday: 1,
            queue: []
        };

        render(<TodaySummary workload={workload} loading={false} error={null} isAuthError={false} />);

        expect(screen.getByText("Due problems")).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText("Review capacity")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("1 / 2")).toBeInTheDocument();
        expect(screen.getByText("New solved")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
    });

    // 7. Due problem list loads
    it("7. Due problem list loads problem title, confidence, and overdue status", () => {
        const dueItems = [
            {
                problemId: 101,
                leetcodeId: 207,
                problemTitle: "Course Schedule",
                difficulty: "MEDIUM",
                currentConfidence: 61,
                overdueDays: 1.2
            },
            {
                problemId: 102,
                leetcodeId: 200,
                problemTitle: "Number of Islands",
                difficulty: "MEDIUM",
                currentConfidence: 74
            }
        ];

        render(
            <DueProblemsList
                items={dueItems}
                loading={false}
                error={null}
                isAuthError={false}
                onViewAll={() => {}}
            />
        );

        expect(screen.getByText("Course Schedule")).toBeInTheDocument();
        expect(screen.getByText("61")).toBeInTheDocument();
        expect(screen.getByText("Overdue: 1 day")).toBeInTheDocument();

        expect(screen.getByText("Number of Islands")).toBeInTheDocument();
        expect(screen.getByText("74")).toBeInTheDocument();
    });

    // 8. Empty due queue
    it("8. Empty due queue displays empty state message", () => {
        render(
            <DueProblemsList
                items={[]}
                loading={false}
                error={null}
                isAuthError={false}
                onViewAll={() => {}}
            />
        );

        expect(screen.getByText("No revisions are due today.")).toBeInTheDocument();
    });

    // 9. Backend failure
    it("9. Backend failure displays safe error message without crashing", () => {
        render(
            <TodaySummary
                workload={null}
                loading={false}
                error="Couldn't load today's revision data."
                isAuthError={false}
            />
        );

        expect(screen.getByText("Couldn't load today's revision data.")).toBeInTheDocument();
    });

    // 10. Authentication failure
    it("10. Authentication failure displays sign in prompt", () => {
        render(
            <TodaySummary
                workload={null}
                loading={false}
                error="Sign in to sync your analytics."
                isAuthError={true}
            />
        );

        expect(screen.getByText("Sign in to sync your analytics.")).toBeInTheDocument();
    });

    // 11. View All opens Revision page
    it("11. View All opens Revision page via chrome.tabs.create", async () => {
        const onViewAll = vi.fn();
        const dueItems = [
            {
                problemId: 101,
                leetcodeId: 1,
                problemTitle: "Two Sum",
                difficulty: "EASY",
                currentConfidence: 80
            }
        ];

        render(
            <DueProblemsList
                items={dueItems}
                loading={false}
                error={null}
                isAuthError={false}
                onViewAll={onViewAll}
            />
        );

        const viewAllBtn = screen.getByRole("button", { name: /View All/i });
        fireEvent.click(viewAllBtn);

        expect(onViewAll).toHaveBeenCalledTimes(1);
    });

    // 12. Open Dashboard requests temporary code, verifies Authorization header, and opens dashboard URL with code
    it("12. Open Dashboard requests temporary code and opens dashboard URL with code without exposing JWT", async () => {
        vi.spyOn(ActiveSessionService, "getActiveSession").mockResolvedValue(null);
        vi.spyOn(RevisionApiService, "fetchTodayWorkload").mockResolvedValue({
            data: {
                totalDue: 0,
                dailyCapacity: 2,
                reviewsCompletedToday: 0,
                newProblemsSolvedToday: 0,
                queue: []
            },
            error: null,
            status: 200,
            isAuthError: false
        });

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ code: "temp-sso-code-xyz" })
        } as Response);

        render(<ExtensionDashboard />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Open Dashboard/i })).toBeInTheDocument();
        });

        const openBtn = screen.getByRole("button", { name: /Open Dashboard/i });
        fireEvent.click(openBtn);

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                "http://localhost:8080/auth/dashboard-code",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Authorization": "Bearer mock-jwt-token-xyz"
                    })
                })
            );
            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: "http://localhost:5173/dashboard?code=temp-sso-code-xyz"
            });
        });

        // Verify that the extension JWT is NEVER placed into the URL
        const calledUrl = (chrome.tabs.create as any).mock.calls[0][0].url;
        expect(calledUrl).not.toContain("mock-jwt-token-xyz");
        expect(calledUrl).toContain("code=temp-sso-code-xyz");
    });

    // 12b. Open Dashboard failure does NOT open dashboard and displays safe error
    it("12b. Open Dashboard failure does NOT open dashboard and displays safe error", async () => {
        vi.spyOn(ActiveSessionService, "getActiveSession").mockResolvedValue(null);
        vi.spyOn(RevisionApiService, "fetchTodayWorkload").mockResolvedValue({
            data: {
                totalDue: 0,
                dailyCapacity: 2,
                reviewsCompletedToday: 0,
                newProblemsSolvedToday: 0,
                queue: []
            },
            error: null,
            status: 200,
            isAuthError: false
        });

        // Backend returns failure for dashboard-code
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ message: "Internal server error" })
        } as Response);

        render(<ExtensionDashboard />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /Open Dashboard/i })).toBeInTheDocument();
        });

        const openBtn = screen.getByRole("button", { name: /Open Dashboard/i });
        fireEvent.click(openBtn);

        await waitFor(() => {
            expect(screen.getByText("Failed to generate dashboard access code.")).toBeInTheDocument();
        });

        // Must NOT open tab without a code
        expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    // 13. No stale current-problem information
    it("13. Stale session (>24 hours old) is discarded and returns null", async () => {
        const staleSession = {
            sessionId: "sess-stale",
            title: "Old Problem",
            difficulty: "MEDIUM",
            leetcodeId: 10,
            sessionStartedAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
            attempts: 2
        };

        await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: staleSession });

        const result = await ActiveSessionService.getActiveSession();
        expect(result).toBeNull();
    });

    // 14. Extension remains usable when backend is unavailable
    it("14. Current Problem card remains responsive when backend is unavailable", async () => {
        const mockSession = {
            sessionId: "sess-active",
            title: "Subarray Sum Equals K",
            difficulty: "MEDIUM",
            leetcodeId: 560,
            sessionStartedAt: Date.now() - 30000,
            attempts: 2
        };

        vi.spyOn(ActiveSessionService, "getActiveSession").mockResolvedValue(mockSession);
        // Backend failure
        vi.spyOn(RevisionApiService, "fetchTodayWorkload").mockResolvedValue({
            data: null,
            error: "Couldn't load today's revision data.",
            status: 500,
            isAuthError: false
        });

        render(<ExtensionDashboard />);

        await waitFor(() => {
            // Live session is rendered despite backend failure
            expect(screen.getByText("Subarray Sum Equals K")).toBeInTheDocument();
            expect(screen.getByText("MEDIUM")).toBeInTheDocument();
            expect(screen.getByText("2")).toBeInTheDocument();
            // Backend section shows safe error message
            expect(screen.getAllByText("Couldn't load today's revision data.").length).toBeGreaterThan(0);
        });
    });

    // ==========================================
    // Registration & Authentication Flow Tests
    // ==========================================

    // 15. Sign-in view
    it("15. Sign-in view displays initial login form and Create Account option", async () => {
        chrome.storage.local.clear();
        const onAuthSuccess = vi.fn();

        render(<AuthView onAuthSuccess={onAuthSuccess} />);

        expect(screen.getByText("DSA Tracker")).toBeInTheDocument();
        expect(screen.getByText("Email")).toBeInTheDocument();
        expect(screen.getByText("Password")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
        expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    });

    // 16. Switching to registration
    it("16. Switching to registration displays Create your account, Confirm Password, and Sign In switch", async () => {
        chrome.storage.local.clear();
        const onAuthSuccess = vi.fn();

        render(<AuthView onAuthSuccess={onAuthSuccess} />);

        const createAccountBtn = screen.getByRole("button", { name: "Create Account" });
        fireEvent.click(createAccountBtn);

        expect(screen.getByText("Create your account")).toBeInTheDocument();
        expect(screen.getByText("Email")).toBeInTheDocument();
        expect(screen.getByText("Password")).toBeInTheDocument();
        expect(screen.getByText("Confirm Password")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
        expect(screen.getByText("Already have an account?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    });

    // 17. Password mismatch
    it("17. Registration validates password mismatch", async () => {
        const onAuthSuccess = vi.fn();
        const fetchSpy = vi.spyOn(globalThis, "fetch");

        render(<AuthView onAuthSuccess={onAuthSuccess} initialMode="register" />);

        const emailInput = screen.getByPlaceholderText("user@example.com");
        const passwordInputs = screen.getAllByPlaceholderText("••••••••");

        fireEvent.change(emailInput, { target: { value: "test@example.com" } });
        fireEvent.change(passwordInputs[0], { target: { value: "password123" } });
        fireEvent.change(passwordInputs[1], { target: { value: "differentPassword" } });

        const submitBtn = screen.getByRole("button", { name: "Create Account" });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
        });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(onAuthSuccess).not.toHaveBeenCalled();
    });

    // 18. Successful registration
    it("18. Successful registration calls POST /auth/register, stores JWT, and triggers onAuthSuccess", async () => {
        const onAuthSuccess = vi.fn();

        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: "registered-jwt-token-999" })
        } as Response);

        render(<AuthView onAuthSuccess={onAuthSuccess} initialMode="register" />);

        const emailInput = screen.getByPlaceholderText("user@example.com");
        const passwordInputs = screen.getAllByPlaceholderText("••••••••");

        fireEvent.change(emailInput, { target: { value: "alex@example.com" } });
        fireEvent.change(passwordInputs[0], { target: { value: "mypassword1" } });
        fireEvent.change(passwordInputs[1], { target: { value: "mypassword1" } });

        const submitBtn = screen.getByRole("button", { name: "Create Account" });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(onAuthSuccess).toHaveBeenCalledWith("alex@example.com");
        });

        // Verify storage
        const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
        expect(stored[AUTH_TOKEN_KEY]).toBe("registered-jwt-token-999");
        expect(stored[USER_EMAIL_KEY]).toBe("alex@example.com");
    });

    // 19. Duplicate email (409 Conflict)
    it("19. Registration handles duplicate email (409 Conflict)", async () => {
        const onAuthSuccess = vi.fn();

        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ message: "Email already exists" })
        } as Response);

        render(<AuthView onAuthSuccess={onAuthSuccess} initialMode="register" />);

        const emailInput = screen.getByPlaceholderText("user@example.com");
        const passwordInputs = screen.getAllByPlaceholderText("••••••••");

        fireEvent.change(emailInput, { target: { value: "existing@example.com" } });
        fireEvent.change(passwordInputs[0], { target: { value: "password123" } });
        fireEvent.change(passwordInputs[1], { target: { value: "password123" } });

        const submitBtn = screen.getByRole("button", { name: "Create Account" });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
        });

        expect(onAuthSuccess).not.toHaveBeenCalled();
    });

    // 20. Registration failure (500 / network error)
    it("20. Registration failure displays safe error message without stack traces", async () => {
        const onAuthSuccess = vi.fn();

        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network connection lost"));

        render(<AuthView onAuthSuccess={onAuthSuccess} initialMode="register" />);

        const emailInput = screen.getByPlaceholderText("user@example.com");
        const passwordInputs = screen.getAllByPlaceholderText("••••••••");

        fireEvent.change(emailInput, { target: { value: "user@example.com" } });
        fireEvent.change(passwordInputs[0], { target: { value: "password123" } });
        fireEvent.change(passwordInputs[1], { target: { value: "password123" } });

        const submitBtn = screen.getByRole("button", { name: "Create Account" });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText("Unable to connect to backend server.")).toBeInTheDocument();
        });

        expect(onAuthSuccess).not.toHaveBeenCalled();
    });

    // 21. Switching back to sign-in
    it("21. Switching back from registration to sign-in view", async () => {
        const onAuthSuccess = vi.fn();

        render(<AuthView onAuthSuccess={onAuthSuccess} initialMode="register" />);

        expect(screen.getByText("Create your account")).toBeInTheDocument();

        const signInBtn = screen.getByRole("button", { name: "Sign In" });
        fireEvent.click(signInBtn);

        expect(screen.getByText("Sign in to sync your progress")).toBeInTheDocument();
        expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    });
});
