import type { ProblemMetadata } from "../../domain/problem/ProblemMetadata";
import {
    extractSlug,
    findProblemHeading,
    parseProblemHeading,
    extractDifficulty,
    extractTopics
} from "./leetcodeDomParser";

export function extractProblemMetadata(): ProblemMetadata | null {
    const url = window.location.href;
    const slug = extractSlug(url);
    if (!slug) {
        return null;
    }

    const heading = findProblemHeading();
    if (!heading) {
        return null;
    }

    const parsedHeading = parseProblemHeading(heading);
    if (!parsedHeading) {
        return null;
    }

    const difficulty = extractDifficulty();
    if (!difficulty) {
        return null;
    }

    const topics = extractTopics();

    return {
        leetcodeId: parsedHeading.leetcodeId,
        slug,
        title: parsedHeading.title,
        difficulty,
        topics,
        url
    };
}