import type { VercelResponse, VercelRequest } from "@vercel/node";

export function json<T>(res: VercelResponse, status: number, body: T) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function noContent(res: VercelResponse) {
  res.status(204);
  res.end();
}

export function methodNotAllowed(res: VercelResponse, methods: string[]) {
  res.setHeader("Allow", methods.join(", "));
  res.status(405).end();
}

export async function parseJson<T>(req: VercelRequest): Promise<T | null> {
  if (typeof req.body === "string") {
    return JSON.parse(req.body) as T;
  }

  if (req.body && typeof req.body === "object") {
    return req.body as T;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as T;
}

export function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getNumberQuery(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(getQueryValue(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
