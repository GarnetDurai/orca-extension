export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface ProblemMetadata {
    leetcodeId: number;
    slug: string;
    leetcodeSlug?: string;
    title: string;
    difficulty: Difficulty;
    topics: string[];
    url: string;
}