import { defineConfig, build, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function contentScriptPlugin(): Plugin {
    return {
        name: "build-content-script",
        apply: "build",
        async closeBundle() {
            await build({
                configFile: false,
                build: {
                    emptyOutDir: false,
                    lib: {
                        entry: resolve(rootDir, "src/content/content.ts"),
                        name: "DSAContentScript",
                        formats: ["iife"],
                        fileName: () => "content/content.js"
                    },
                    outDir: resolve(rootDir, "dist")
                }
            });
        }
    };
}

export default defineConfig({
    plugins: [react(), tailwindcss(), contentScriptPlugin()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
    },
    build: {
        rollupOptions: {
            input: {
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
                    return "assets/[name].js";
                },
                chunkFileNames: "chunks/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]"
            }
        }
    }
});