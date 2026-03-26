// Message types for communication between content script, popup, and background

export const MessageType = {
  API_REQUEST: "API_REQUEST",
  API_RESPONSE: "API_RESPONSE",
  SSE_EVENT: "SSE_EVENT",
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_STATUS: "AUTH_STATUS",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  OPEN_MODAL: "OPEN_MODAL",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** Content script or popup requests an API call through the background worker. */
export interface ApiRequestMessage {
  type: typeof MessageType.API_REQUEST;
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
}

/** Background worker returns an API response. */
export interface ApiResponseMessage {
  type: typeof MessageType.API_RESPONSE;
  id: string;
  status: number;
  data?: unknown;
  error?: string;
}

/** Background worker forwards an SSE event to content scripts. */
export interface SseEventMessage {
  type: typeof MessageType.SSE_EVENT;
  eventType: string;
  data: unknown;
}

/** Trigger the OAuth login flow. */
export interface AuthLoginMessage {
  type: typeof MessageType.AUTH_LOGIN;
}

/** Request current auth state. */
export interface AuthStatusMessage {
  type: typeof MessageType.AUTH_STATUS;
}

/** Clear tokens and log out. */
export interface AuthLogoutMessage {
  type: typeof MessageType.AUTH_LOGOUT;
}

/** Tell content script to open the review modal. */
export interface OpenModalMessage {
  type: typeof MessageType.OPEN_MODAL;
}

/** Auth status response payload. */
export interface AuthStatusResponse {
  loggedIn: boolean;
  userId?: string;
  username?: string;
}

export type ExtensionMessage =
  | ApiRequestMessage
  | ApiResponseMessage
  | SseEventMessage
  | AuthLoginMessage
  | AuthStatusMessage
  | AuthLogoutMessage
  | OpenModalMessage;
