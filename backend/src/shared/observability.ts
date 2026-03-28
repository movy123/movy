import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export function attachObservabilityHooks(app: FastifyInstance, startedAt = Date.now()) {
  app.addHook("onRequest", async (request: FastifyRequest) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        route: request.url,
        idempotencyKey: request.headers["idempotency-key"]?.toString() ?? null
      },
      "request started"
    );
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        route: request.url,
        statusCode: reply.statusCode,
        durationMs: reply.elapsedTime,
        idempotencyKey: request.headers["idempotency-key"]?.toString() ?? null
      },
      "request completed"
    );
  });

  app.addHook("onError", async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    request.log.error(
      {
        reqId: request.id,
        method: request.method,
        route: request.url,
        statusCode: reply.statusCode,
        errorName: error.name,
        errorMessage: error.message,
        idempotencyKey: request.headers["idempotency-key"]?.toString() ?? null
      },
      "request failed"
    );
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode ?? (reply.statusCode >= 400 ? reply.statusCode : 500);
    request.log.error(
      {
        reqId: request.id,
        method: request.method,
        route: request.url,
        statusCode,
        errorName: error.name,
        errorMessage: error.message,
        idempotencyKey: request.headers["idempotency-key"]?.toString() ?? null
      },
      "unhandled request error"
    );

    reply.code(statusCode).send({
      message: statusCode >= 500 ? "Internal server error" : error.message,
      requestId: request.id
    });
  });

  return {
    processStartedAt: new Date(startedAt).toISOString(),
    getProcessUptimeMs: () => Date.now() - startedAt
  };
}
