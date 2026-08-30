import type { ProblemSession } from "../../domain/session/ProblemSession";

export type SubmissionResult =
    | "ACCEPTED"
    | "WRONG_ANSWER"
    | "TIME_LIMIT_EXCEEDED"
    | "MEMORY_LIMIT_EXCEEDED"
    | "RUNTIME_ERROR"
    | "COMPILE_ERROR";

const KNOWN_RESULT_TEXTS: Record<string, SubmissionResult> = {
    "Accepted": "ACCEPTED",
    "Wrong Answer": "WRONG_ANSWER",
    "Time Limit Exceeded": "TIME_LIMIT_EXCEEDED",
    "Memory Limit Exceeded": "MEMORY_LIMIT_EXCEEDED",
    "Runtime Error": "RUNTIME_ERROR",
    "Compile Error": "COMPILE_ERROR"
};

const SUBMISSION_ID_TIMEOUT_MS = 30000;
const RESULT_RENDER_TIMEOUT_MS = 30000;

export class SubmissionTracker {
    private session: ProblemSession;
    private waitingForNewSubmission = false;
    private waitingForResult = false;
    private previousSubmissionId: string | null = null;
    private currentTrackingSubmissionId: string | null = null;
    private lastConfirmedSubmissionId: string | null = null;
    private submissionPhaseStartTime = 0;
    private resultPhaseStartTime = 0;
    private observer: MutationObserver | null = null;
    private pollTimer: number | null = null;
    private isListening = false;
    private onSolved: ((solvedAt: number) => void) | null = null;

    private readonly handleClick = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest("button");
        if (!button) {
            return;
        }

        const buttonText = button.textContent?.trim() || "";
        const isSubmit =
            button.getAttribute("data-e2e-locator") === "console-submit-button" ||
            button.getAttribute("data-cy") === "submit-code-btn" ||
            buttonText === "Submit" ||
            buttonText.startsWith("Submit");

        if (isSubmit) {
            this.initiateSubmission();
        }
    };

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            this.initiateSubmission();
        }
    };

    private readonly handleRuntimeMessage = (message: any): void => {
        if (message?.type === "SUBMISSION_RATE_LIMITED") {
            this.handleRateLimit();
        }
    };

    constructor(session: ProblemSession) {
        this.session = session;
    }

    public start(onSolved?: (solvedAt: number) => void): void {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        this.onSolved = onSolved ?? null;
        document.addEventListener("click", this.handleClick, true);
        document.addEventListener("keydown", this.handleKeyDown, true);
        chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
    }

    public stop(): void {
        if (!this.isListening) {
            return;
        }

        document.removeEventListener("click", this.handleClick, true);
        document.removeEventListener("keydown", this.handleKeyDown, true);
        chrome.runtime.onMessage.removeListener(this.handleRuntimeMessage);
        this.stopWatching();
        this.lastConfirmedSubmissionId = null;
        this.isListening = false;
        this.onSolved = null;
    }

    private initiateSubmission(): void {
        // Prevent duplicate initiation while already waiting
        if (this.waitingForNewSubmission || this.waitingForResult) {
            return;
        }

        // Use lastConfirmedSubmissionId if available, fallback to current URL
        this.previousSubmissionId =
            this.lastConfirmedSubmissionId ?? this.extractSubmissionId(window.location.href);
        this.currentTrackingSubmissionId = null;
        this.waitingForNewSubmission = true;
        this.waitingForResult = false;
        this.submissionPhaseStartTime = Date.now();

        console.log("[DSA Tracker] Submit initiated");
        console.log("[DSA Tracker] Previous submission ID:", this.previousSubmissionId);

        this.startWatching();
    }

    private startWatching(): void {
        // Clean up any existing listeners/timers without resetting submission state
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        // 1. MutationObserver on document.body
        this.observer = new MutationObserver(() => {
            if (!this.waitingForNewSubmission && !this.waitingForResult) {
                return;
            }
            this.checkForSubmission();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // 2. Poll every 250ms
        this.pollTimer = window.setInterval(() => {
            if (!this.waitingForNewSubmission && !this.waitingForResult) {
                if (this.pollTimer !== null) {
                    window.clearInterval(this.pollTimer);
                    this.pollTimer = null;
                }
                return;
            }

            this.checkForSubmission();
        }, 250);
    }

    private stopWatching(): void {
        this.waitingForNewSubmission = false;
        this.waitingForResult = false;
        this.previousSubmissionId = null;
        this.currentTrackingSubmissionId = null;

        // NOTE: lastConfirmedSubmissionId is NOT reset here so it persists across submissions

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private handleRateLimit(): void {
        if (!this.waitingForNewSubmission && !this.waitingForResult) {
            return;
        }

        console.log("[DSA Tracker] Submission rate limited: HTTP 429");
        console.log("[DSA Tracker] Aborting submission watcher without counting attempt");

        this.stopWatching();
    }

    private checkForSubmission(): void {
        if (!this.waitingForNewSubmission && !this.waitingForResult) {
            return;
        }

        // PHASE 1: Gate on the new submission ID
        if (this.waitingForNewSubmission) {
            // Check Phase 1 timeout
            if (Date.now() - this.submissionPhaseStartTime > SUBMISSION_ID_TIMEOUT_MS) {
                console.warn(
                    "[DSA Tracker] Submission request timed out — no new submission ID detected (possible rate limit or network issue)."
                );
                this.stopWatching();
                return;
            }

            const currentSubmissionId = this.extractSubmissionId(window.location.href);

            if (this.previousSubmissionId !== null) {
                if (
                    currentSubmissionId === null ||
                    currentSubmissionId === this.previousSubmissionId
                ) {
                    console.log("[DSA Tracker] Waiting for NEW submission ID...");
                    return;
                }
            } else {
                if (currentSubmissionId === null) {
                    console.log("[DSA Tracker] Waiting for first submission ID...");
                    return;
                }
            }

            // New submission ID has definitely appeared!
            console.log("[DSA Tracker] New submission detected:", currentSubmissionId);
            this.currentTrackingSubmissionId = currentSubmissionId;
            this.waitingForNewSubmission = false;
            this.waitingForResult = true;
            this.resultPhaseStartTime = Date.now();
        }

        // PHASE 2: Result detection below the new-submission gate
        if (!this.waitingForResult) {
            return;
        }

        // Check Phase 2 timeout
        if (Date.now() - this.resultPhaseStartTime > RESULT_RENDER_TIMEOUT_MS) {
            console.warn("[DSA Tracker] Submission result render timed out.");
            this.stopWatching();
            return;
        }

        const detected = this.findCurrentVisibleResult();
        if (!detected) {
            console.log("[DSA Tracker] Waiting for current submission result...");
            return;
        }

        console.log("[DSA Tracker] Result detected:", detected);
        console.log("[DSA Tracker] Submission confirmed:", detected);

        this.finalizeSubmission(detected);
    }

    private finalizeSubmission(result: SubmissionResult): void {
        if (this.waitingForNewSubmission) {
            console.warn("[DSA Tracker] BLOCKED premature finalization before new submission");
            return;
        }

        const now = Date.now();

        // Increment attempts exactly once per confirmed submission
        this.session.attempts++;

        // Record persistent last confirmed submission ID
        if (this.currentTrackingSubmissionId) {
            this.lastConfirmedSubmissionId = this.currentTrackingSubmissionId;
        }

        // Record submission event
        this.session.events.push({
            type: "SUBMISSION",
            timestamp: now,
            result,
            submissionId: this.currentTrackingSubmissionId ?? undefined
        });

        // If solved / accepted
        if (result === "ACCEPTED") {
            this.session.solved = true;
            this.session.solvedAt = now;

            this.session.events.push({
                type: "SOLVED",
                timestamp: now,
                result: "ACCEPTED"
            });

            console.log("[DSA Tracker] Problem SOLVED!");
            this.onSolved?.(now);
        }

        console.log(
            `[DSA Tracker] Submission finalized. Attempts: ${this.session.attempts} (ID: ${this.lastConfirmedSubmissionId ?? "N/A"})`
        );

        // Reset state and stop watching
        this.stopWatching();
    }

    /**
     * Extracts submission ID from URL (e.g. /problems/two-sum/submissions/2122795524/).
     */
    private extractSubmissionId(url: string): string | null {
        const match = url.match(/\/submissions\/(?:detail\/)?(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Finds the visible exact result on the current submission view.
     * Priority:
     * 1. If WRONG_ANSWER (or other failure state) is visible, it takes precedence over ACCEPTED
     *    to prevent an old Run result ("Accepted") from masking a failed submission.
     * 2. Else if ACCEPTED is visible, return ACCEPTED.
     */
    private findCurrentVisibleResult(): SubmissionResult | null {
        console.log("[DSA Tracker] Checking submission result candidates");

        const candidates = document.querySelectorAll("div, span, p, h1, h2, h3, h4");
        const foundResults = new Set<SubmissionResult>();

        for (const el of Array.from(candidates)) {
            const text = el.textContent?.trim();
            if (!text || !(text in KNOWN_RESULT_TEXTS)) {
                continue;
            }

            // Check bounding dimensions
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }

            // Check CSS visibility
            const style = window.getComputedStyle(el);
            if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                style.opacity === "0"
            ) {
                continue;
            }

            const result = KNOWN_RESULT_TEXTS[text];
            foundResults.add(result);

            if (result === "WRONG_ANSWER") {
                console.log("[DSA Tracker] Wrong Answer detected");
            } else if (result === "ACCEPTED") {
                console.log("[DSA Tracker] Accepted detected");
            }
        }

        if (foundResults.size === 0) {
            return null;
        }

        // Priority 1: WRONG_ANSWER and failure results take precedence over ACCEPTED
        if (foundResults.has("WRONG_ANSWER")) {
            console.log("[DSA Tracker] Submission result selected: WRONG_ANSWER");
            return "WRONG_ANSWER";
        }
        if (foundResults.has("TIME_LIMIT_EXCEEDED")) {
            console.log("[DSA Tracker] Submission result selected: TIME_LIMIT_EXCEEDED");
            return "TIME_LIMIT_EXCEEDED";
        }
        if (foundResults.has("MEMORY_LIMIT_EXCEEDED")) {
            console.log("[DSA Tracker] Submission result selected: MEMORY_LIMIT_EXCEEDED");
            return "MEMORY_LIMIT_EXCEEDED";
        }
        if (foundResults.has("RUNTIME_ERROR")) {
            console.log("[DSA Tracker] Submission result selected: RUNTIME_ERROR");
            return "RUNTIME_ERROR";
        }
        if (foundResults.has("COMPILE_ERROR")) {
            console.log("[DSA Tracker] Submission result selected: COMPILE_ERROR");
            return "COMPILE_ERROR";
        }

        // Priority 2: ACCEPTED
        if (foundResults.has("ACCEPTED")) {
            console.log("[DSA Tracker] Submission result selected: ACCEPTED");
            return "ACCEPTED";
        }

        return null;
    }
}
