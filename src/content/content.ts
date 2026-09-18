import { extractProblemMetadata } from "./metadata/problemMetadataExtractor";
import { SessionManager } from "./tracking/SessionManager";
import { ThinkingCodingTracker } from "./tracking/ThinkingCodingTracker";
import { EditorActivityTracker } from "./tracking/EditorActivityTracker";
import { TabVisibilityTracker } from "./tracking/TabVisibilityTracker";
import { HintEditorialTracker } from "./tracking/HintEditorialTracker";
import { SolutionTracker } from "./tracking/SolutionTracker";
import { SubmissionTracker } from "./tracking/SubmissionTracker";
import { SessionApiClient } from "./api/SessionApiClient";
import { SessionQueueService } from "../services/sessionQueueService";
import type { ProblemSession } from "../domain/session/ProblemSession";

const sessionManager = new SessionManager();

function syncActiveSession(session: ProblemSession | null): void {
    try {
        if (session && !session.solved) {
            chrome.storage.local.set({
                activeProblemSession: {
                    sessionId: session.sessionId,
                    title: session.problem.title,
                    difficulty: session.problem.difficulty,
                    leetcodeId: session.problem.leetcodeId,
                    url: session.problem.url,
                    sessionStartedAt: session.sessionStartedAt,
                    attempts: session.attempts,
                    lastUpdated: Date.now()
                }
            });
        } else {
            chrome.storage.local.remove("activeProblemSession");
        }
    } catch {
        // Safe catch for detached extension context
    }
}

let lastUrl = window.location.href;
let lastProcessedSlug: string | null = null;
let retryTimer: number | null = null;

let editorActivityTracker: EditorActivityTracker | null = null;
let thinkingCodingTracker: ThinkingCodingTracker | null = null;
let tabVisibilityTracker: TabVisibilityTracker | null = null;
let hintEditorialTracker: HintEditorialTracker | null = null;
let solutionTracker: SolutionTracker | null = null;
let submissionTracker: SubmissionTracker | null = null;

/**
 * Extract the problem slug directly from the current URL.
 */
function getSlugFromUrl(url: string): string | null {
    const match = url.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
}

/**
 * Stop all behavior tracking associated with the current/previous problem.
 */
function cleanupPreviousTracking(endTime: number = Date.now()): void {
    syncActiveSession(null);
    // 1. Flush any pending time away before finalizing coding time
    tabVisibilityTracker?.stop();
    tabVisibilityTracker = null;

    editorActivityTracker?.stop();
    editorActivityTracker = null;

    hintEditorialTracker?.stop();
    hintEditorialTracker = null;

    solutionTracker?.stop();
    solutionTracker = null;

    submissionTracker?.stop();
    submissionTracker = null;

    // 2. Finalize total coding/solve time
    thinkingCodingTracker?.finalizeCodingTime(endTime);
    thinkingCodingTracker = null;
}

/**
 * Extract the current problem and create a new session
 * when a genuinely new problem is detected.
 */
function processCurrentProblem(): boolean {
    const currentUrl = window.location.href;
    const expectedSlug = getSlugFromUrl(currentUrl);

    // Not currently on a LeetCode problem page
    if (!expectedSlug) {
        return false;
    }

    const metadata = extractProblemMetadata();

    // DOM is not ready yet
    if (!metadata) {
        return false;
    }

    // Ensure metadata belongs to the problem represented by the current URL
    if (metadata.slug !== expectedSlug) {
        return false;
    }

    // Same problem is already being tracked
    if (metadata.slug === lastProcessedSlug) {
        return true;
    }

    // Stop tracking the previous problem before creating a new session
    cleanupPreviousTracking();

    const previousSession = sessionManager.getCurrentSession();
    if (previousSession) {
        const endedSession = sessionManager.endCurrentSession();
        console.log("[DSA Tracker] Previous session ended:", endedSession);
    }

    // Create the new problem session
    const session = sessionManager.startSession(metadata);
    lastProcessedSlug = metadata.slug;
    syncActiveSession(session);

    console.log("[DSA Tracker] Problem Metadata:", metadata);
    console.log("[DSA Tracker] Session Started:", session);

    // 1. Thinking / Coding time tracker
    thinkingCodingTracker = new ThinkingCodingTracker(session);

    // 2. Editor activity tracker (first keystroke, copy/paste, language)
    editorActivityTracker = new EditorActivityTracker(session);
    editorActivityTracker.start(() => {
        thinkingCodingTracker?.startCoding();
    });

    // 3. Tab visibility tracker (away time excluded from coding duration)
    tabVisibilityTracker = new TabVisibilityTracker(session);
    tabVisibilityTracker.start((awayDuration) => {
        thinkingCodingTracker?.recordTimeAway(awayDuration);
    });

    // 4. Hint and Editorial usage tracker
    hintEditorialTracker = new HintEditorialTracker(session);
    hintEditorialTracker.start();

    // 5. Solution section / tab view tracker
    solutionTracker = new SolutionTracker(session);
    solutionTracker.start();

    // 6. Submission and result tracker
    submissionTracker = new SubmissionTracker(session);
    submissionTracker.start(
        (solvedAt) => {
            syncActiveSession(null);
            // Stop all active behavior trackers and finalize total solve duration at solvedAt
            cleanupPreviousTracking(solvedAt);

            // End the ProblemSession immediately at the first Accepted submission
            const endedSession = sessionManager.endCurrentSession();
            console.log("[DSA Tracker] Session SOLVED and Ended:", endedSession);

            // Upload the completed session to the backend
            if (endedSession) {
                SessionApiClient.uploadSession(endedSession)
                    .then(async (res) => {
                        if (res.success) {
                            console.log("[DSA Tracker] Session uploaded successfully:", res.sessionId);
                            SessionQueueService.flushPendingSessions().catch(() => {});
                        } else {
                            console.warn("[DSA Tracker] Upload deferred; queueing session:", res.sessionId);
                            await SessionQueueService.queueSession(endedSession);
                        }
                    })
                    .catch(async (err) => {
                        console.error("[DSA Tracker] Upload failed, queueing session:", err);
                        await SessionQueueService.queueSession(endedSession);
                    });
            }
        },
        (_attempts) => {
            syncActiveSession(session);
        }
    );

    return true;
}

/**
 * Retry metadata extraction while LeetCode is rendering a new problem.
 */
function waitForProblemMetadata(): void {
    if (retryTimer !== null) {
        window.clearInterval(retryTimer);
    }

    const startTime = Date.now();

    retryTimer = window.setInterval(() => {
        const success = processCurrentProblem();
        if (success) {
            if (retryTimer !== null) {
                window.clearInterval(retryTimer);
                retryTimer = null;
            }
            return;
        }

        // Stop retrying after 10 seconds
        if (Date.now() - startTime > 10000) {
            if (retryTimer !== null) {
                window.clearInterval(retryTimer);
                retryTimer = null;
            }
            console.warn("[DSA Tracker] Unable to extract valid problem metadata.");
        }
    }, 250);
}

/**
 * Detect LeetCode SPA navigation.
 */
function checkForNavigation(): void {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) {
        return;
    }

    lastUrl = currentUrl;
    waitForProblemMetadata();
}

/**
 * Initialize the extension.
 */
function initialize(): void {
    // Process problem on initial page load
    if (!processCurrentProblem()) {
        waitForProblemMetadata();
    }

    // Monitor URL changes for SPA navigation
    window.setInterval(checkForNavigation, 500);
}

initialize();

// Listen for messages from popup to provide instant active session data
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === "GET_ACTIVE_SESSION") {
        const current = sessionManager.getCurrentSession();
        if (current && !current.solved) {
            sendResponse({
                active: true,
                session: {
                    sessionId: current.sessionId,
                    title: current.problem.title,
                    difficulty: current.problem.difficulty,
                    leetcodeId: current.problem.leetcodeId,
                    url: current.problem.url,
                    sessionStartedAt: current.sessionStartedAt,
                    attempts: current.attempts
                }
            });
        } else {
            sendResponse({ active: false });
        }
    }
});

window.addEventListener("pagehide", () => syncActiveSession(null));
window.addEventListener("beforeunload", () => syncActiveSession(null));

window.addEventListener("online", () => {
    console.log("[DSA Tracker] Browser connectivity restored. Attempting pending session flush...");
    SessionQueueService.flushPendingSessions().catch(() => {});
});