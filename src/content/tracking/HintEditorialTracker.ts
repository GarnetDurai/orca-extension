import type { ProblemSession } from "../../domain/session/ProblemSession";

export class HintEditorialTracker {
    private session: ProblemSession;
    private isListening = false;

    private readonly handleClick = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        this.checkHintClick(target);
        this.checkEditorialOrSolutionClick(target);
    };

    constructor(session: ProblemSession) {
        this.session = session;
    }

    public start(): void {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        document.addEventListener("click", this.handleClick, true);

        // Check if the current URL already points directly to editorial or solutions
        this.checkUrlForResourceView();
    }

    public stop(): void {
        if (!this.isListening) {
            return;
        }

        document.removeEventListener("click", this.handleClick, true);
        this.isListening = false;
    }

    /**
     * Detects if the clicked element is a Hint toggle/accordion.
     */
    private checkHintClick(element: HTMLElement): void {
        const clickable = element.closest("button, div, summary, a");
        if (!clickable) {
            return;
        }

        const text = clickable.textContent?.trim() || "";
        const isHintElement =
            /^Hint\s*\d+/i.test(text) ||
            clickable.getAttribute("data-key")?.toLowerCase().startsWith("hint");

        if (isHintElement) {
            const now = Date.now();
            this.session.hintOpened = true;
            this.session.hintOpenCount++;
            this.session.events.push({
                type: "HINT_OPENED",
                timestamp: now
            });

            console.log("[DSA Tracker] Hint opened. Total count:", this.session.hintOpenCount);
        }
    }

    /**
     * Detects if the clicked element is the Editorial or Solutions tab.
     */
    private checkEditorialOrSolutionClick(element: HTMLElement): void {
        const clickable = element.closest("a, button, div[role='tab']");
        if (!clickable) {
            return;
        }

        const text = clickable.textContent?.trim().toLowerCase() || "";
        const href = clickable.getAttribute("href")?.toLowerCase() || "";
        const now = Date.now();

        // Check Editorial
        if (text === "editorial" || href.includes("/editorial")) {
            if (!this.session.editorialViewed) {
                this.session.editorialViewed = true;
                this.session.editorialViewedAt = now;
            }
            this.session.events.push({
                type: "EDITORIAL_VIEWED",
                timestamp: now
            });
            console.log("[DSA Tracker] Editorial tab viewed.");
            return;
        }

        // Check Solutions
        if (text === "solutions" || href.includes("/solutions")) {
            if (!this.session.solutionViewed) {
                this.session.solutionViewed = true;
                this.session.solutionViewedAt = now;
            }
            this.session.events.push({
                type: "SOLUTION_VIEWED",
                timestamp: now
            });
            console.log("[DSA Tracker] Solutions tab viewed.");
        }
    }

    /**
     * Checks if the page URL currently opened is an editorial or solutions sub-route.
     */
    private checkUrlForResourceView(): void {
        const pathname = window.location.pathname.toLowerCase();
        const now = Date.now();

        if (pathname.includes("/editorial") && !this.session.editorialViewed) {
            this.session.editorialViewed = true;
            this.session.editorialViewedAt = now;
            this.session.events.push({
                type: "EDITORIAL_VIEWED",
                timestamp: now
            });
        } else if (pathname.includes("/solutions") && !this.session.solutionViewed) {
            this.session.solutionViewed = true;
            this.session.solutionViewedAt = now;
            this.session.events.push({
                type: "SOLUTION_VIEWED",
                timestamp: now
            });
        }
    }
}
