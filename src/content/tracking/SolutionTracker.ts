import type { ProblemSession } from "../../domain/session/ProblemSession";

export class SolutionTracker {
    private session: ProblemSession;
    private isListening = false;
    private observer: MutationObserver | null = null;

    private readonly handleClick = (event: MouseEvent): void => {
        if (this.session.solutionViewed) {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        this.checkElementForSolutionView(target);
    };

    constructor(session: ProblemSession) {
        this.session = session;
    }

    public start(): void {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        console.log("[DSA Tracker] Solution tracker started");

        document.addEventListener("click", this.handleClick, true);

        // 1. Check current URL (e.g. if loaded directly on /solutions)
        this.checkCurrentUrl();

        // 2. Check current DOM if Solutions tab is already active
        this.checkDomForActiveSolution();

        // 3. Observe DOM mutations (in case LeetCode mounts solutions tab via SPA routing)
        this.observer = new MutationObserver(() => {
            if (this.session.solutionViewed) {
                this.stopObserver();
                return;
            }
            this.checkCurrentUrl();
            this.checkDomForActiveSolution();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    public stop(): void {
        if (!this.isListening) {
            return;
        }

        document.removeEventListener("click", this.handleClick, true);
        this.stopObserver();
        this.isListening = false;
    }

    private stopObserver(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * Checks if the clicked element represents opening the Solutions tab or viewing a solution.
     */
    private checkElementForSolutionView(element: HTMLElement): void {
        if (this.session.solutionViewed) {
            return;
        }

        const clickable = element.closest("a, button, [role='tab'], div");
        if (!clickable) {
            return;
        }

        const text = clickable.textContent?.trim().toLowerCase() || "";
        const href = (clickable.getAttribute("href") || "").toLowerCase();
        const ariaLabel = (clickable.getAttribute("aria-label") || "").toLowerCase();
        const dataKey = (clickable.getAttribute("data-key") || "").toLowerCase();

        const isSolutionClick =
            text === "solutions" ||
            text === "solution" ||
            href.includes("/solutions") ||
            ariaLabel.includes("solution") ||
            dataKey.includes("solution");

        if (isSolutionClick) {
            this.recordSolutionView();
        }
    }

    /**
     * Checks if the URL path currently points to the solutions route.
     */
    private checkCurrentUrl(): void {
        if (this.session.solutionViewed) {
            return;
        }

        const pathname = window.location.pathname.toLowerCase();
        if (pathname.includes("/solutions")) {
            this.recordSolutionView();
        }
    }

    /**
     * Checks if the Solutions tab is currently active/selected in the DOM.
     */
    private checkDomForActiveSolution(): void {
        if (this.session.solutionViewed) {
            return;
        }

        // Check for active tab containing "Solutions"
        const activeTabs = document.querySelectorAll(
            '[role="tab"][aria-selected="true"], [role="tab"][data-state="active"], a[data-state="active"]'
        );

        for (const tab of Array.from(activeTabs)) {
            const text = tab.textContent?.trim().toLowerCase() || "";
            const href = (tab.getAttribute("href") || "").toLowerCase();
            if (text === "solutions" || text === "solution" || href.includes("/solutions")) {
                this.recordSolutionView();
                return;
            }
        }
    }

    /**
     * Records the single SOLUTION_VIEWED event and updates session state.
     */
    private recordSolutionView(): void {
        if (this.session.solutionViewed) {
            return;
        }

        const now = Date.now();
        this.session.solutionViewed = true;
        this.session.solutionViewedAt = now;

        this.session.events.push({
            type: "SOLUTION_VIEWED",
            timestamp: now
        });

        console.log("[DSA Tracker] Solution viewed");
        console.log(`[DSA Tracker] Solution viewed at: ${now}`);

        // Disconnect observer now that solution view has been captured
        this.stopObserver();
    }
}
