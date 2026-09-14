import { AUTH_TOKEN_KEY, getDashboardConfig } from "../config/dashboardConfig";
import type { TodayWorkloadData } from "../domain/revision/RevisionQueueTypes";

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    status: number | null;
    isAuthError: boolean;
}

export class RevisionApiService {
    public static async fetchTodayWorkload(): Promise<ApiResponse<TodayWorkloadData>> {
        const config = await getDashboardConfig();

        let token: string | null = null;
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                const stored = await chrome.storage.local.get(AUTH_TOKEN_KEY);
                token = (stored[AUTH_TOKEN_KEY] as string) || null;
            }
        } catch {
            // Storage access failed
        }

        if (!token) {
            return {
                data: null,
                error: "Sign in to sync your analytics.",
                status: 401,
                isAuthError: true
            };
        }

        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const url = new URL(`${config.backendUrl}/analytics/revisions/today`);
            if (timeZone) {
                url.searchParams.set("timeZone", timeZone);
            }

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                const body = await response.json();
                const workload: TodayWorkloadData = {
                    totalDue: body.totalDue ?? 0,
                    dailyCapacity: body.dailyCapacity ?? 1,
                    reviewsCompletedToday: body.reviewsCompletedToday ?? 0,
                    newProblemsSolvedToday: body.newProblemsSolvedToday ?? 0,
                    queue: (body.queue || []).map((item: any) => ({
                        problemId: item.problemId,
                        leetcodeId: item.leetcodeId,
                        problemTitle: item.problemTitle || "Problem #" + item.leetcodeId,
                        difficulty: item.difficulty || "MEDIUM",
                        currentConfidence: Math.round(item.currentConfidence ?? 0),
                        retentionStrength: item.retentionStrength,
                        overdueDays: item.overdueDays,
                        nextReviewAt: item.nextReviewAt,
                        currentIntervalDays: item.currentIntervalDays
                    }))
                };

                return {
                    data: workload,
                    error: null,
                    status: response.status,
                    isAuthError: false
                };
            }

            if (response.status === 401) {
                return {
                    data: null,
                    error: "Sign in to sync your analytics.",
                    status: 401,
                    isAuthError: true
                };
            }

            if (response.status === 403) {
                return {
                    data: null,
                    error: "Access denied. Please check your account permissions.",
                    status: 403,
                    isAuthError: false
                };
            }

            if (response.status === 404) {
                return {
                    data: null,
                    error: "Revision service currently unavailable.",
                    status: 404,
                    isAuthError: false
                };
            }

            if (response.status === 409) {
                return {
                    data: null,
                    error: "Conflict retrieving revision queue.",
                    status: 409,
                    isAuthError: false
                };
            }

            return {
                data: null,
                error: "Couldn't load today's revision data.",
                status: response.status,
                isAuthError: false
            };
        } catch {
            return {
                data: null,
                error: "Couldn't load today's revision data.",
                status: null,
                isAuthError: false
            };
        }
    }
}
