export interface ActiveProblemSession {
    sessionId: string;
    title: string;
    difficulty: string;
    leetcodeId: number;
    url?: string;
    sessionStartedAt: number;
    attempts: number;
    lastUpdated?: number;
}
