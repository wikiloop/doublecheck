import type { MiddlewareHandler } from "hono";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/.*\.wikipedia\.org$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/.*\.wikiloop\.org$/,
  /^https?:\/\/.*\.toolforge\.org$/,
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function corsMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("Origin") ?? "";

    if (origin && isAllowedOrigin(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
    }

    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Last-Event-ID",
    );
    c.header("Access-Control-Max-Age", "86400");

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  };
}
