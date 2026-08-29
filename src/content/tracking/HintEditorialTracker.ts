import type { ProblemSession } from "../../domain/session/ProblemSession";

export class HintEditorialTracker {
    private session: ProblemSession;
    private isListening = false;
    private observer: MutationObserver | null = null;
    private openHints = new Set<string>();
    private lastHintClickTime = 0;

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
        this.openHints.clear();
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
        this.openHints.clear();
        this.isListening = false;
    }

    private stopObserver(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * Detects if the clicked element represents toggling a Hint accordion.
     */
    private checkHintClick(target: HTMLElement): void {
        const now = Date.now();
        if (now - this.lastHintClickTime < 250) {
            return;
        }

        const hintInfo = this.findHintHeader(target);
        if (!hintInfo) {
            return;
        }

        const { header, hintName } = hintInfo;

        // Determine if the hint was open before this click
        let wasOpen = this.openHints.has(hintName);

        // Check DOM attributes if present on the header
        const withAria = header.getAttribute("aria-expanded") !== null
            ? header
            : header.closest("[aria-expanded]");
        if (withAria) {
            const ariaVal = withAria.getAttribute("aria-expanded");
            if (ariaVal === "true") {
                wasOpen = true;
            } else if (ariaVal === "false") {
                wasOpen = false;
            }
        } else {
            const withData = header.getAttribute("data-state") !== null
                ? header
                : header.closest("[data-state]");
            if (withData) {
                const dataVal = withData.getAttribute("data-state");
                if (dataVal === "open") {
                    wasOpen = true;
                } else if (dataVal === "closed") {
                    wasOpen = false;
                }
            }
        }

        this.lastHintClickTime = now;

        if (!wasOpen) {
            // State transition: CLOSED -> OPEN
            this.openHints.add(hintName);
            this.session.hintOpened = true;
            this.session.hintOpenCount++;

            if (this.session.hintOpenedAt === null) {
                this.session.hintOpenedAt = now;
            }

            this.session.events.push({
                type: "HINT_OPENED",
                timestamp: now
            });

            console.log("[DSA Tracker] Hint opened");
            console.log(`[DSA Tracker] Hint open count: ${this.session.hintOpenCount}`);
        } else {
            // State transition: OPEN -> CLOSED (closing does not increment count)
            this.openHints.delete(hintName);
        }
    }

    /**
     * Identifies if the clicked target belongs to a Hint toggle header bar.
     */
    private findHintHeader(target: HTMLElement): { header: HTMLElement; hintName: string } | null {
        // 1. Check if the target itself or a close ancestor is a hint header element
        const candidate = target.closest<HTMLElement>("button, [role='button'], div, summary, a");
        if (!candidate) {
            return null;
        }

        const text = candidate.textContent?.trim() || "";
        const dataKey = (candidate.getAttribute("data-key") || "").toLowerCase();

        // If data-key directly identifies the hint (e.g. data-key="hint-0")
        if (dataKey.startsWith("hint")) {
            const numMatch = dataKey.match(/hint-(\d+)/) || text.match(/\bHint\s*(\d+)\b/i);
            const name = numMatch ? `Hint ${parseInt(numMatch[1], 10) + 1}` : "Hint";
            return { header: candidate, hintName: name };
        }

        // Check if the candidate's direct text matches "Hint 1", "Hint 2", etc.
        // We limit length to 80 chars so we only match the header bar, not the expanded hint body
        if (text.length < 80) {
            const match = text.match(/^Hint\s*(\d+)/i) || text.match(/\bHint\s*(\d+)\b/i);
            if (match) {
                return { header: candidate, hintName: `Hint ${match[1]}` };
            }
        } else {
            // If the candidate container is large (e.g. parent accordion wrapper), inspect closer children/ancestors
            const directHeader = target.closest<HTMLElement>("div.flex, button, [role='button'], summary");
            if (directHeader && directHeader !== candidate) {
                const directText = directHeader.textContent?.trim() || "";
                const match = directText.match(/^Hint\s*(\d+)/i) || directText.match(/\bHint\s*(\d+)\b/i);
                if (match && directText.length < 80) {
                    return { header: directHeader, hintName: `Hint ${match[1]}` };
                }
            }
        }

        return null;
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
