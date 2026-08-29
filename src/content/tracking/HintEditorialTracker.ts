import type { ProblemSession } from "../../domain/session/ProblemSession";

export class HintEditorialTracker {
    private session: ProblemSession;
    private isListening = false;
    private observer: MutationObserver | null = null;

    private readonly handleClick = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        this.checkHintClick(target);
        this.checkEditorialClick(target);
    };

    constructor(session: ProblemSession) {
        this.session = session;
    }

    public start(): void {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        console.log("[DSA Tracker] Hint/Editorial tracker started");

        document.addEventListener("click", this.handleClick, true);

        // 1. Check if the current URL already points directly to editorial
        this.checkCurrentUrl();

        // 2. Check if the Editorial tab is currently active/selected in the DOM
        this.checkDomForActiveEditorial();

        // 3. Observe DOM mutations (in case LeetCode mounts editorial tab via SPA routing)
        this.observer = new MutationObserver(() => {
            if (this.session.editorialViewed) {
                this.stopObserver();
                return;
            }
            this.checkCurrentUrl();
            this.checkDomForActiveEditorial();
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
     * Detects if the clicked element represents opening/viewing the Editorial tab.
     */
    private checkEditorialClick(element: HTMLElement): void {
        if (this.session.editorialViewed) {
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

        const isEditorialClick =
            text === "editorial" ||
            href.includes("/editorial") ||
            ariaLabel.includes("editorial") ||
            dataKey.includes("editorial");

        if (isEditorialClick) {
            this.recordEditorialView();
        }
    }

    /**
     * Checks if the page URL currently opened is an editorial sub-route.
     */
    private checkCurrentUrl(): void {
        if (this.session.editorialViewed) {
            return;
        }

        const pathname = window.location.pathname.toLowerCase();
        if (pathname.includes("/editorial")) {
            this.recordEditorialView();
        }
    }

    /**
     * Checks if the Editorial tab is currently active/selected in the DOM.
     */
    private checkDomForActiveEditorial(): void {
        if (this.session.editorialViewed) {
            return;
        }

        // Check for active tab containing "Editorial"
        const activeTabs = document.querySelectorAll(
            '[role="tab"][aria-selected="true"], [role="tab"][data-state="active"], a[data-state="active"]'
        );

        for (const tab of Array.from(activeTabs)) {
            const text = tab.textContent?.trim().toLowerCase() || "";
            const href = (tab.getAttribute("href") || "").toLowerCase();
            if (text === "editorial" || href.includes("/editorial")) {
                this.recordEditorialView();
                return;
            }
        }
    }

    /**
     * Records the single EDITORIAL_VIEWED event and updates session state.
     */
    private recordEditorialView(): void {
        if (this.session.editorialViewed) {
            return;
        }

        const now = Date.now();
        this.session.editorialViewed = true;
        this.session.editorialViewedAt = now;

        this.session.events.push({
            type: "EDITORIAL_VIEWED",
            timestamp: now
        });

        console.log("[DSA Tracker] Editorial viewed");
        console.log(`[DSA Tracker] Editorial viewed at: ${now}`);

        // Disconnect observer now that editorial view has been captured
        this.stopObserver();
    }
}
