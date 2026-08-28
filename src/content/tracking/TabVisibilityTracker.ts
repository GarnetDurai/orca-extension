import type { ProblemSession } from "../../domain/session/ProblemSession";

export class TabVisibilityTracker {
    private session: ProblemSession;
    private hiddenAt: number | null = null;
    private started = false;
    private onTimeAway: ((duration: number) => void) | null = null;

    private readonly handleVisibilityChange = (): void => {
        if (document.hidden) {
            this.handleHidden();
        } else {
            this.handleVisible();
        }
    };

    constructor(session: ProblemSession) {
        this.session = session;
    }

    public start(onTimeAway?: (duration: number) => void): void {
        if (this.started) {
            return;
        }

        this.started = true;
        this.onTimeAway = onTimeAway ?? null;
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    public stop(): void {
        if (!this.started) {
            return;
        }

        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        this.started = false;

        // If the tracker is stopped while the tab is hidden, close the current interval
        if (this.hiddenAt !== null) {
            this.handleVisible();
        }
        this.onTimeAway = null;
    }

    private handleHidden(): void {
        // Prevent duplicate hidden events
        if (this.hiddenAt !== null) {
            return;
        }

        this.hiddenAt = Date.now();
        this.session.tabSwitchCount++;
        this.session.events.push({
            type: "TAB_HIDDEN",
            timestamp: this.hiddenAt
        });

        console.log("[DSA Tracker] Tab hidden. Switch count:", this.session.tabSwitchCount);
    }

    private handleVisible(): void {
        if (this.hiddenAt === null) {
            return;
        }

        const visibleAt = Date.now();
        const awayDuration = visibleAt - this.hiddenAt;
        this.session.totalTimeAway += awayDuration;

        this.session.events.push({
            type: "TAB_VISIBLE",
            timestamp: visibleAt
        });

        console.log("[DSA Tracker] Tab visible. Time away:", awayDuration, "ms (Total:", this.session.totalTimeAway, "ms)");

        // Notify listener (e.g. ThinkingCodingTracker) so active coding time is accurate
        this.onTimeAway?.(awayDuration);

        this.hiddenAt = null;
    }
}