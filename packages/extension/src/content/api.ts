// Content script API helper — proxies requests through background service worker

import { MessageType, type ApiResponseMessage } from "../background/messages.js";

let requestCounter = 0;

function generateId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

/**
 * Send an API request through the background service worker.
 */
export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null; error?: string }> {
  const id = generateId();

  const response = (await chrome.runtime.sendMessage({
    type: MessageType.API_REQUEST,
    id,
    method,
    path,
    body,
  })) as ApiResponseMessage;

  return {
    status: response.status,
    data: response.data as T | null,
    error: response.error,
  };
}

/**
 * Convenience GET request.
 */
export function apiGet<T = unknown>(path: string) {
  return apiRequest<T>("GET", path);
}

/**
 * Convenience POST request.
 */
export function apiPost<T = unknown>(path: string, body?: unknown) {
  return apiRequest<T>("POST", path, body);
}
