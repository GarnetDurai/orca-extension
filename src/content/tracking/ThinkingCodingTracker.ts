import type { ProblemSession } from "../../domain/session/ProblemSession";

export class ThinkingCodingTracker {
    private session: ProblemSession;
    private timeAwayDuringCoding = 0;

    constructor(session: ProblemSession) {
        this.session = session;
    }

    public startCoding(): void {
        // Coding has already started; preserve firstCodingAt across submissions
        if (this.session.firstCodingAt !== null) {
            return;
        }

        const now = Date.now();
        this.session.firstCodingAt = now;
        this.session.thinkingDuration = Math.max(
            0,
            now - this.session.sessionStartedAt - this.session.totalTimeAway
        );

        this.session.events.push({
            type: "CODING_STARTED",
            timestamp: now
        });

        console.log("[DSA Tracker] Coding started.");
        console.log("[DSA Tracker] Thinking time:", this.session.thinkingDuration, "ms");
    }

    /**
     * Records time spent away from the tab while coding is active,
     * so that time away is excluded from the active coding duration.
     */
    public recordTimeAway(awayDuration: number): void {
        if (this.session.firstCodingAt !== null) {
            this.timeAwayDuringCoding += awayDuration;
        }
    }

    /**
     * Finalizes total active solve/coding duration (wall-clock span minus time away).
     * Calculates across all submission attempts from firstCodingAt to solvedAt.
     */
    public finalizeCodingTime(endTime: number = Date.now()): void {
        if (this.session.firstCodingAt === null) {
            // If user never typed before submitting, thinking is full active time and coding is 0
            this.session.thinkingDuration = Math.max(
                0,
                endTime - this.session.sessionStartedAt - this.session.totalTimeAway
            );
            this.session.codingDuration = 0;
            console.log("[DSA Tracker] Final active coding duration: 0 ms (no editor activity)");
            return;
        }

        const totalElapsed = endTime - this.session.firstCodingAt;
        this.session.codingDuration = Math.max(0, totalElapsed - this.timeAwayDuringCoding);
        console.log("[DSA Tracker] Final total active coding duration across all attempts:", this.session.codingDuration, "ms");
    }
}