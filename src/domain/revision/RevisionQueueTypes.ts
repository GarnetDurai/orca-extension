export interface DueProblemItemData {
    problemId: number;
    leetcodeId: number;
    problemTitle: string;
    difficulty: string;
    currentConfidence: number;
    retentionStrength?: number;
    overdueDays?: number;
    nextReviewAt?: string;
    currentIntervalDays?: number;
}

export interface TodayWorkloadData {
    totalDue: number;
    dailyCapacity: number;
    reviewsCompletedToday: number;
    newProblemsSolvedToday: number;
    queue: DueProblemItemData[];
}
