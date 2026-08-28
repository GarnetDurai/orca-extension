import type { Difficulty } from "../../domain/problem/ProblemMetadata";

export function extractSlug(url: string): string | null {
    const match = url.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
}

export function findProblemHeading(): string | null {
    const elements = Array.from(document.querySelectorAll("a, div, span, h4"));
    for (const element of elements) {
        const text = element.textContent?.trim();
        if (!text) {
            continue;
        }
        if (/^\d+\.\s+.+$/.test(text)) {
            return text;
        }
    }
    return null;
}

export function parseProblemHeading(
    heading: string
): { leetcodeId: number; title: string } | null {
    const match = heading.match(/^(\d+)\.\s+(.+)$/);
    if (!match) {
        return null;
    }
    return {
        leetcodeId: Number(match[1]),
        title: match[2].trim()
    };
}

export function extractDifficulty(): Difficulty | null {
    const possibleValues: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
    const elements = Array.from(document.querySelectorAll("span, div"));

    for (const element of elements) {
        const text = element.textContent?.trim();
        if (!text) {
            continue;
        }
        const normalized = text.toUpperCase();
        if (possibleValues.includes(normalized as Difficulty)) {
            return normalized as Difficulty;
        }
    }
    return null;
}

export function extractTopics(): string[] {
    const topicLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href^="/tag/"]')
    ).filter((link) => {
        const rect = link.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });

    if (topicLinks.length === 0) {
        return [];
    }

    /*
     * Group topic links by their immediate parent.
     *
     * Example:
     * div
     * ├── Principal
     * ├── <a href="/tag/linked-list/">Linked List</a>
     * ├── <a href="/tag/math/">Math</a>
     * └── <a href="/tag/recursion/">Recursion</a>
     */
    const groups = new Map<Element, HTMLAnchorElement[]>();
    for (const link of topicLinks) {
        const parent = link.parentElement;
        if (!parent) {
            continue;
        }
        const existing = groups.get(parent) ?? [];
        existing.push(link);
        groups.set(parent, existing);
    }

    /*
     * The Topics container normally contains multiple /tag/ links.
     * Select the group with the largest number of topic links.
     */
    let topicGroup: HTMLAnchorElement[] = [];
    for (const links of groups.values()) {
        if (links.length > topicGroup.length) {
            topicGroup = links;
        }
    }

    const topics: string[] = [];
    for (const link of topicGroup) {
        const topic = link.textContent?.trim();
        if (topic && !topics.includes(topic)) {
            topics.push(topic);
        }
    }
    return topics;
}