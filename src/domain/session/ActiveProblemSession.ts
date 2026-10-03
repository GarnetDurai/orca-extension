export interface ActiveProblemSession {
    sessionId: string;
    title: string;
    difficulty: string;
    leetcodeId: number;
    leetcodeSlug?: string;
    url?: string;
    sessionStartedAt: number;
    attempts: number;
    lastUpdated?: number;
}
