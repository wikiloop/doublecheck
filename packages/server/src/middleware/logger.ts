import type { MiddlewareHandler } from "hono";

export function loggerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    const logEntry = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logEntry));
  };
}
