// Background service worker — handles API proxying, OAuth, and SSE

import {
  MessageType,
  type ApiRequestMessage,
  type ApiResponseMessage,
  type AuthStatusResponse,
  type ExtensionMessage,
  type SseEventMessage,
} from "./messages.js";
import { launchOAuthFlow, getAuthStatus, getAccessToken, logout } from "./auth.js";

// ---------------------------------------------------------------------------
// Dynamic popup: on Wikipedia → no popup (icon click opens modal directly);
// elsewhere → show popup.html
// ---------------------------------------------------------------------------

function isWikipediaUrl(url?: string): boolean {
  return !!url && /^https:\/\/\w+\.wikipedia\.org\//.test(url);
}

function updatePopupForTab(tabId: number, url?: string): void {
  if (isWikipediaUrl(url)) {
    chrome.action.setPopup({ tabId, popup: "" });
  } else {
    chrome.action.setPopup({ tabId, popup: "popup.html" });
  }
}

// When a tab is activated, update the popup setting
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updatePopupForTab(activeInfo.tabId, tab.url);
  } catch { /* tab may have closed */ }
});

// When a tab navigates, update the popup setting
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updatePopupForTab(tabId, tab.url);
  }
});

// When the icon is clicked (no popup set → on Wikipedia), tell content script to open modal
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: MessageType.OPEN_MODAL }).catch(() => {
      // Content script not loaded — fall back to opening dashboard
      chrome.tabs.create({ url: "https://wikiloop-doublecheck.toolforge.org" });
    });
  }
});

const API_BASE = "https://wikiloop-doublecheck.toolforge.org";

// ---------------------------------------------------------------------------
// SSE connection
// ---------------------------------------------------------------------------

let eventSource: EventSource | null = null;

function connectSSE(): void {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`${API_BASE}/api/events`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const message: SseEventMessage = {
        type: MessageType.SSE_EVENT,
        eventType: data.type ?? "message",
        data: data.data ?? data,
      };

      // Forward to all tabs
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {
              // Tab may not have content script — ignore
            });
          }
        }
      });
    } catch {
      // Ignore malformed SSE data
    }
  };

  eventSource.onerror = () => {
    // Reconnect after delay
    eventSource?.close();
    eventSource = null;
    setTimeout(connectSSE, 5000);
  };
}

// Start SSE on install/startup
chrome.runtime.onInstalled.addListener(() => {
  connectSSE();
});

chrome.runtime.onStartup.addListener(() => {
  connectSSE();
});

// ---------------------------------------------------------------------------
// API proxy
// ---------------------------------------------------------------------------

async function handleApiRequest(
  request: ApiRequestMessage,
): Promise<ApiResponseMessage> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${request.path}`, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    const data = await response.json().catch(() => null);

    return {
      type: MessageType.API_RESPONSE,
      id: request.id,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      type: MessageType.API_RESPONSE,
      id: request.id,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    switch (message.type) {
      case MessageType.API_REQUEST:
        handleApiRequest(message).then(sendResponse);
        return true; // Keep channel open for async response

      case MessageType.AUTH_LOGIN:
        launchOAuthFlow()
          .then((tokenData) => {
            const response: AuthStatusResponse = {
              loggedIn: true,
              userId: tokenData.userId,
              username: tokenData.username,
            };
            sendResponse(response);
          })
          .catch((error) => {
            sendResponse({
              loggedIn: false,
              error: error instanceof Error ? error.message : "Login failed",
            });
          });
        return true;

      case MessageType.AUTH_STATUS:
        getAuthStatus().then(sendResponse);
        return true;

      case MessageType.AUTH_LOGOUT:
        logout().then(() => sendResponse({ loggedIn: false }));
        return true;

      default:
        return false;
    }
  },
);
