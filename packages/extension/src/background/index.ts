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
// No popup — clicking the icon opens the review modal directly via content
// script on Wikipedia. On other sites, opens the web dashboard.
// ---------------------------------------------------------------------------

// Show version in the icon tooltip
const ver = chrome.runtime.getManifest().version;
chrome.action.setTitle({ title: `DoubleCheck v${ver} — Click to review` });

chrome.action.onClicked.addListener((tab) => {
  if (tab.id && tab.url && /^https:\/\/\w+\.wikipedia\.org\//.test(tab.url)) {
    // On Wikipedia: open modal overlay via content script
    chrome.tabs.sendMessage(tab.id, { type: MessageType.OPEN_MODAL }).catch(() => {
      // Content script not ready — open popup window as fallback
      openReviewPopup();
    });
  } else {
    // Not on Wikipedia: open review in a popup window (modal-like)
    openReviewPopup();
  }
});

function openReviewPopup(): void {
  chrome.windows.create({
    url: "https://wikiloop-doublecheck.toolforge.org/review",
    type: "popup",
    width: 1000,
    height: 750,
  });
}

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
