import { SessionQueueService } from "../services/sessionQueueService";

/**
 * Background service worker for observing network response statuses (e.g. HTTP 429 Too Many Requests)
 * on LeetCode submission endpoints and flushing pending sessions upon extension lifecycle events.
 */

chrome.webRequest.onCompleted.addListener(
    (details) => {
        // Detect HTTP 429 (Too Many Requests) on /submit/ requests
        if (details.statusCode === 429 && details.url.includes("/submit/")) {
            if (details.tabId > 0) {
                chrome.tabs.sendMessage(details.tabId, {
                    type: "SUBMISSION_RATE_LIMITED",
                    statusCode: 429,
                    url: details.url
                }).catch(() => {
                    // Ignore errors if the content script is not listening
                });
            }
        }
    },
    { urls: ["https://leetcode.com/problems/*/submit/"] }
);

// Flush pending sessions on extension startup and install
chrome.runtime.onStartup.addListener(() => {
    SessionQueueService.flushPendingSessions().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
    SessionQueueService.flushPendingSessions().catch(() => {});
});
