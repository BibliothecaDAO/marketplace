const CURSOR_VERSION = 1;
const MAX_CURSOR_BYTES = 2_048;

type CursorPayload = {
  v: number;
  kind: string;
  key: unknown;
};

export class CursorError extends Error {
  constructor(message = "Invalid pagination cursor.") {
    super(message);
    this.name = "CursorError";
  }
}

export function encodeCursor<T>(kind: string, key: T): string {
  const json = JSON.stringify({ v: CURSOR_VERSION, kind, key });
  if (Buffer.byteLength(json, "utf8") > MAX_CURSOR_BYTES) {
    throw new CursorError("Pagination cursor payload is too large.");
  }
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor<T>(cursor: string, expectedKind: string): T {
  if (!cursor || cursor.length > MAX_CURSOR_BYTES * 2) throw new CursorError();

  let payload: CursorPayload;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    if (Buffer.byteLength(json, "utf8") > MAX_CURSOR_BYTES) throw new CursorError();
    payload = JSON.parse(json) as CursorPayload;
  } catch (error) {
    if (error instanceof CursorError) throw error;
    throw new CursorError();
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    payload.v !== CURSOR_VERSION ||
    payload.kind !== expectedKind ||
    payload.key === null ||
    typeof payload.key !== "object"
  ) {
    throw new CursorError();
  }

  return payload.key as T;
}
