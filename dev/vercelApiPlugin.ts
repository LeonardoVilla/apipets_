import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleApi } from "../server/router";

type AnyReq = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown };
type AnyRes = ServerResponse & {
  status?: (code: number) => AnyRes;
  send?: (body?: any) => AnyRes;
  json?: (body: any) => AnyRes;
};

function enhanceRes(res: AnyRes): AnyRes {
  if (!res.status) {
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
  }

  if (!res.send) {
    res.send = (body?: any) => {
      if (body === undefined) {
        res.end();
        return res;
      }

      if (Buffer.isBuffer(body) || typeof body === "string") {
        res.end(body);
        return res;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      return res;
    };
  }

  if (!res.json) {
    res.json = (body: any) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      return res;
    };
  }

  return res;
}

function parseUrl(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const protocol = "http";
  return new URL(req.url ?? "/", `${protocol}://${host}`);
}

const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".local-data");
const UPLOADS_DIR = path.join(LOCAL_DATA_DIR, "uploads");

async function serveLocalUpload(req: IncomingMessage, res: ServerResponse) {
  const url = parseUrl(req);
  if (!url.pathname.startsWith("/__uploads/")) return false;

  const relative = url.pathname.replace("/__uploads/", "");
  const normalized = path.posix
    .normalize("/" + relative)
    .replace(/^\//, "")
    .replace(/^\.\.(\/|\\)/g, "");

  const filePath = path.join(UPLOADS_DIR, normalized);

  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end();
    return true;
  }

  // Content-Type: keep it simple; browsers will still display/download.
  res.statusCode = 200;
  createReadStream(filePath).pipe(res);
  return true;
}

export function vercelApiPlugin(): Plugin {
  return {
    name: "vercel-api-middleware",
    apply: "serve",
    async configureServer(server) {
      await mkdir(UPLOADS_DIR, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        if (await serveLocalUpload(req, res)) {
          return;
        }

        const url = parseUrl(req);
        const shouldHandle =
          url.pathname === "/docs" ||
          url.pathname === "/openapi" ||
          url.pathname.startsWith("/autenticacao/") ||
          url.pathname.startsWith("/v1/");

        if (!shouldHandle) {
          next();
          return;
        }

        const anyReq = req as AnyReq;
        const anyRes = enhanceRes(res as AnyRes);

        const query: Record<string, string | string[] | undefined> = {};
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });

        // Vercel populates req.query; we emulate it for local dev.
        anyReq.query = query;

        try {
          await handleApi(anyReq as any, anyRes as any);
        } catch (err) {
          anyRes.statusCode = 500;
          anyRes.setHeader("Content-Type", "application/json; charset=utf-8");
          anyRes.end(JSON.stringify({ message: "Erro interno.", detail: String(err) }));
        }
      });
    },
  };
}

// For Windows path edge-cases in ESM transpilation
void fileURLToPath;
