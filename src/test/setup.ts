import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock global chrome extension API for Vitest environment
const storageData: Record<string, any> = {};

const chromeMock = {
    storage: {
        local: {
            get: vi.fn((keys: string | string[] | null) => {
                if (typeof keys === "string") {
                    return Promise.resolve({ [keys]: storageData[keys] });
                }
                if (Array.isArray(keys)) {
                    const result: Record<string, any> = {};
                    keys.forEach((k) => {
                        result[k] = storageData[k];
                    });
                    return Promise.resolve(result);
                }
                return Promise.resolve({ ...storageData });
            }),
            set: vi.fn((items: Record<string, any>) => {
                Object.assign(storageData, items);
                return Promise.resolve();
            }),
            remove: vi.fn((keys: string | string[]) => {
                if (typeof keys === "string") {
                    delete storageData[keys];
                } else if (Array.isArray(keys)) {
                    keys.forEach((k) => delete storageData[k]);
                }
                return Promise.resolve();
            }),
            clear: vi.fn(() => {
                Object.keys(storageData).forEach((k) => delete storageData[k]);
                return Promise.resolve();
            }),
        },
        sync: {
            get: vi.fn(() => Promise.resolve({})),
            set: vi.fn(() => Promise.resolve()),
        }
    },
    tabs: {
        create: vi.fn((params: { url: string }) => Promise.resolve({ id: 1, ...params })),
        query: vi.fn(() => Promise.resolve([{ id: 101, url: "https://leetcode.com/problems/two-sum/" }])),
        sendMessage: vi.fn(() => Promise.resolve({ active: false })),
    },
    runtime: {
        sendMessage: vi.fn(() => Promise.resolve()),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        }
    }
};

(globalThis as any).chrome = chromeMock;
