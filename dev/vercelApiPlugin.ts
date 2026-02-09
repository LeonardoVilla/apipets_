import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import docsHandler from "../api/docs";
import openapiHandler from "../api/openapi";
import loginHandler from "../api/autenticacao/login";
import refreshHandler from "../api/autenticacao/refresh";

import petsHandler from "../api/v1/pets";
import petByIdHandler from "../api/v1/pets/[id]";
import petFotosHandler from "../api/v1/pets/[id]/fotos";
import petFotoByIdHandler from "../api/v1/pets/[id]/fotos/[fotoId]";

import tutoresHandler from "../api/v1/tutores";
import tutorByIdHandler from "../api/v1/tutores/[id]";
import tutorFotosHandler from "../api/v1/tutores/[id]/fotos";
import tutorFotoByIdHandler from "../api/v1/tutores/[id]/fotos/[fotoId]";
import tutorPetLinkHandler from "../api/v1/tutores/[id]/pets/[petId]";

type AnyReq = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown };
type AnyRes = ServerResponse & {
  status?: (code: number) => AnyRes;
  send?: (body?: any) => AnyRes;
  json?: (body: any) => AnyRes;
};

type Route = {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: (req: any, res: any) => any;
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

function matchRoute(routes: Route[], method: string, pathname: string) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = pathname.match(route.pattern);
    if (!m) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, idx) => {
      params[name] = decodeURIComponent(m[idx + 1] ?? "");
    });

    return { route, params };
  }
  return null;
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
  const routes: Route[] = [
    { method: "GET", pattern: /^\/docs\/?$/, paramNames: [], handler: docsHandler },
    { method: "GET", pattern: /^\/openapi\/?$/, paramNames: [], handler: openapiHandler },

    { method: "POST", pattern: /^\/autenticacao\/login\/?$/, paramNames: [], handler: loginHandler },
    { method: "PUT", pattern: /^\/autenticacao\/refresh\/?$/, paramNames: [], handler: refreshHandler },

    { method: "GET", pattern: /^\/v1\/pets\/?$/, paramNames: [], handler: petsHandler },
    { method: "POST", pattern: /^\/v1\/pets\/?$/, paramNames: [], handler: petsHandler },
    { method: "GET", pattern: /^\/v1\/pets\/([^/]+)\/?$/, paramNames: ["id"], handler: petByIdHandler },
    { method: "PUT", pattern: /^\/v1\/pets\/([^/]+)\/?$/, paramNames: ["id"], handler: petByIdHandler },
    { method: "DELETE", pattern: /^\/v1\/pets\/([^/]+)\/?$/, paramNames: ["id"], handler: petByIdHandler },

    { method: "POST", pattern: /^\/v1\/pets\/([^/]+)\/fotos\/?$/, paramNames: ["id"], handler: petFotosHandler },
    {
      method: "DELETE",
      pattern: /^\/v1\/pets\/([^/]+)\/fotos\/([^/]+)\/?$/,
      paramNames: ["id", "fotoId"],
      handler: petFotoByIdHandler,
    },

    { method: "GET", pattern: /^\/v1\/tutores\/?$/, paramNames: [], handler: tutoresHandler },
    { method: "POST", pattern: /^\/v1\/tutores\/?$/, paramNames: [], handler: tutoresHandler },
    { method: "GET", pattern: /^\/v1\/tutores\/([^/]+)\/?$/, paramNames: ["id"], handler: tutorByIdHandler },
    { method: "PUT", pattern: /^\/v1\/tutores\/([^/]+)\/?$/, paramNames: ["id"], handler: tutorByIdHandler },
    { method: "DELETE", pattern: /^\/v1\/tutores\/([^/]+)\/?$/, paramNames: ["id"], handler: tutorByIdHandler },

    { method: "POST", pattern: /^\/v1\/tutores\/([^/]+)\/fotos\/?$/, paramNames: ["id"], handler: tutorFotosHandler },
    {
      method: "DELETE",
      pattern: /^\/v1\/tutores\/([^/]+)\/fotos\/([^/]+)\/?$/,
      paramNames: ["id", "fotoId"],
      handler: tutorFotoByIdHandler,
    },

    {
      method: "POST",
      pattern: /^\/v1\/tutores\/([^/]+)\/pets\/([^/]+)\/?$/,
      paramNames: ["id", "petId"],
      handler: tutorPetLinkHandler,
    },
    {
      method: "DELETE",
      pattern: /^\/v1\/tutores\/([^/]+)\/pets\/([^/]+)\/?$/,
      paramNames: ["id", "petId"],
      handler: tutorPetLinkHandler,
    },
  ];

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
        const method = (req.method ?? "GET").toUpperCase();
        const match = matchRoute(routes, method, url.pathname);
        if (!match) {
          next();
          return;
        }

        const anyReq = req as AnyReq;
        const anyRes = enhanceRes(res as AnyRes);

        const query: Record<string, string | string[] | undefined> = {};
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });

        // Vercel-style params are merged into query
        anyReq.query = { ...query, ...match.params };

        try {
          await match.route.handler(anyReq, anyRes);
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
