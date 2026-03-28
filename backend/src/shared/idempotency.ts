type IdempotentRecord = {
  fingerprint: string;
  statusCode: number;
  body: unknown;
  createdAt: number;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const records = new Map<string, IdempotentRecord>();

function cleanupExpiredRecords(now = Date.now()) {
  for (const [key, record] of records.entries()) {
    if (now - record.createdAt > TTL_MS) {
      records.delete(key);
    }
  }
}

export async function runIdempotentOperation<T>(input: {
  scope: string;
  key?: string;
  fingerprint: string;
  execute: () => Promise<{ statusCode: number; body: T }>;
}) {
  cleanupExpiredRecords();

  if (!input.key) {
    return {
      replayed: false,
      ...(await input.execute())
    };
  }

  const recordKey = `${input.scope}:${input.key}`;
  const existing = records.get(recordKey);

  if (existing) {
    if (existing.fingerprint !== input.fingerprint) {
      return {
        replayed: false,
        statusCode: 409,
        body: {
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "Idempotency-Key already used with a different request payload"
        }
      };
    }

    return {
      replayed: true,
      statusCode: existing.statusCode,
      body: existing.body as T
    };
  }

  const result = await input.execute();
  records.set(recordKey, {
    fingerprint: input.fingerprint,
    statusCode: result.statusCode,
    body: result.body,
    createdAt: Date.now()
  });

  return {
    replayed: false,
    ...result
  };
}
