/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    plugins: [react(), tailwindcss()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
    },
    build: {
        rollupOptions: {
            input: {
                content: resolve(rootDir, "src/content/content.ts"),
                background: resolve(rootDir, "src/background/background.ts"),
                popup: resolve(rootDir, "src/popup/popup.html")
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === "background") {
                        return "background/background.js";
                    }
                    if (chunkInfo.name === "popup") {
                        return "src/popup/popup.js";
                    }
                    return "content/content.js";
                },
                chunkFileNames: "chunks/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]"
            }
        }
    }
});