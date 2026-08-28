import type { ProblemSession } from "../../domain/session/ProblemSession";

export class EditorActivityTracker {
    private session: ProblemSession;
    private onCodingStarted: (() => void) | null = null;
    private isCodingStarted = false;
    private isListening = false;

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editor = target.closest(".monaco-editor");
        if (!editor) {
            return;
        }

        // Try detecting the programming language if not yet set
        this.detectLanguage(editor);

        if (!this.isCodingStarted) {
            this.isCodingStarted = true;
            this.onCodingStarted?.();
        }
    };

    private readonly handleCopy = (event: ClipboardEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editor = target.closest(".monaco-editor");
        if (!editor) {
            return;
        }

        // Increment copy count and record event (strict privacy: no clipboard content is read)
        this.session.copyCount++;
        this.session.events.push({
            type: "COPY",
            timestamp: Date.now()
        });

        console.log("[DSA Tracker] Editor copy detected. Total copies:", this.session.copyCount);
    };

    private readonly handlePaste = (event: ClipboardEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editor = target.closest(".monaco-editor");
        if (!editor) {
            return;
        }

        // Try detecting language on paste
        this.detectLanguage(editor);

        // Pasting code into the editor also counts as starting coding
        if (!this.isCodingStarted) {
            this.isCodingStarted = true;
            this.onCodingStarted?.();
        }

        // Increment paste count and record event (strict privacy: no clipboard content is read)
        this.session.pasteCount++;
        this.session.events.push({
            type: "PASTE",
            timestamp: Date.now()
        });

        console.log("[DSA Tracker] Editor paste detected. Total pastes:", this.session.pasteCount);
    };

    constructor(session: ProblemSession) {
        this.session = session;
        // If the session already had coding started (e.g. from earlier), sync state
        if (this.session.firstCodingAt !== null) {
            this.isCodingStarted = true;
        }
    }

    public start(onCodingStarted: () => void): void {
        if (this.isListening) {
            return;
        }

        this.onCodingStarted = onCodingStarted;
        this.isListening = true;

        document.addEventListener("keydown", this.handleKeyDown, true);
        document.addEventListener("copy", this.handleCopy, true);
        document.addEventListener("paste", this.handlePaste, true);

        // Check if language can be detected immediately
        this.detectLanguage();
    }

    public stop(): void {
        if (!this.isListening) {
            return;
        }

        document.removeEventListener("keydown", this.handleKeyDown, true);
        document.removeEventListener("copy", this.handleCopy, true);
        document.removeEventListener("paste", this.handlePaste, true);

        this.onCodingStarted = null;
        this.isListening = false;
    }

    /**
     * Attempts to detect the selected programming language.
     * Fails gracefully to null without interrupting the session.
     */
    private detectLanguage(editorElement?: Element | null): void {
        if (this.session.language) {
            return;
        }

        try {
            // 1. Check Monaco editor container data-mode-id attribute
            const editor = editorElement ?? document.querySelector(".monaco-editor");
            if (editor) {
                const modeId = editor.getAttribute("data-mode-id") ||
                    editor.closest("[data-mode-id]")?.getAttribute("data-mode-id");
                if (modeId) {
                    this.session.language = modeId;
                    console.log("[DSA Tracker] Detected language from Monaco mode:", modeId);
                    return;
                }
            }

            // 2. Check LeetCode language dropdown button
            const languageButton = document.querySelector(
                'button[id^="headlessui-listbox-button"], [data-cy="lang-select"]'
            );
            if (languageButton && languageButton.textContent) {
                const langText = languageButton.textContent.trim();
                if (langText) {
                    this.session.language = langText;
                    console.log("[DSA Tracker] Detected language from UI button:", langText);
                    return;
                }
            }
        } catch {
            // Language is optional; do not let detection errors disrupt tracking
            this.session.language = null;
        }
    }
}
