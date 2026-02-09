import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { issueTokens, getBearerToken, verifyRefreshToken, requireAccessToken } from "./_lib/auth";
import { getNumberQuery, getQueryValue, json, methodNotAllowed, noContent, parseJson } from "./_lib/http";
import { toPetResponse, toTutorResponse } from "./_lib/model";
import { parseSingleFile } from "./_lib/multipart";
import { loadStore, saveStore } from "./_lib/store";
import { delByUrl, putPublic } from "./_lib/blob";

const SWAGGER_HTML =
  "<!doctype html>\n" +
  "<html lang=\"pt-BR\">\n" +
  "  <head>\n" +
  "    <meta charset=\"UTF-8\" />\n" +
  "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n" +
  "    <title>Swagger UI</title>\n" +
  "    <link rel=\"stylesheet\" href=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui.css\" />\n" +
  "  </head>\n" +
  "  <body>\n" +
  "    <div id=\"swagger\"></div>\n" +
  "    <script src=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js\"></script>\n" +
  "    <script>\n" +
  "      window.ui = SwaggerUIBundle({\n" +
  "        url: '/openapi',\n" +
  "        dom_id: '#swagger',\n" +
  "      });\n" +
  "    </script>\n" +
  "  </body>\n" +
  "</html>\n";

type RouteMatch = {
  method: string;
  pattern: RegExp;
  handler: (req: VercelRequest, res: VercelResponse, params: Record<string, string>) => Promise<void> | void;
};

function normalizePathname(pathname: string) {
  // Requests may come as /api/... (direct) or /... (via rewrites). Handle both.
  if (pathname.startsWith("/api/")) {
    return pathname.slice(4);
  }
  if (pathname === "/api") {
    return "/";
  }
  return pathname;
}

function getUrl(req: VercelRequest) {
  const host = req.headers.host ?? "localhost";
  return new URL(req.url ?? "/", `http://${host}`);
}

function match(routes: RouteMatch[], method: string, pathname: string) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.pattern);
    if (!m) continue;

    const params: Record<string, string> = {};
    // capture groups become params by index
    if (m.groups) {
      Object.assign(params, m.groups);
    }
    // also provide positional captures
    m.slice(1).forEach((v, idx) => {
      params[String(idx)] = v;
    });

    return { route: r, params };
  }
  return null;
}

export async function handleApi(req: VercelRequest, res: VercelResponse) {
  const url = getUrl(req);
  const pathname = normalizePathname(url.pathname);
  const method = (req.method ?? "GET").toUpperCase();

  const routes: RouteMatch[] = [
    {
      method: "GET",
      pattern: /^\/docs\/?$/,
      handler: async (_req, _res) => {
        _res.setHeader("Content-Type", "text/html; charset=utf-8");
        _res.status(200).send(SWAGGER_HTML);
      },
    },
    {
      method: "GET",
      pattern: /^\/openapi\/?$/,
      handler: async (_req, _res) => {
        const openapiPath = path.join(process.cwd(), "openapi");
        const content = await readFile(openapiPath, "utf8");
        _res.setHeader("Content-Type", "text/yaml; charset=utf-8");
        _res.status(200).send(content);
      },
    },

    {
      method: "POST",
      pattern: /^\/autenticacao\/login\/?$/,
      handler: async (_req, _res) => {
        const body = await parseJson<{ username?: string; password?: string }>(_req);
        const username = body?.username ?? "";
        const password = body?.password ?? "";

        if (username !== "admin" || password !== "admin") {
          json(_res, 401, { message: "Credenciais invalidas." });
          return;
        }

        json(_res, 200, issueTokens("admin"));
      },
    },
    {
      method: "PUT",
      pattern: /^\/autenticacao\/refresh\/?$/,
      handler: async (_req, _res) => {
        const token = getBearerToken(_req);
        if (!token) {
          json(_res, 401, { message: "Token ausente." });
          return;
        }

        const payload = verifyRefreshToken(token);
        if (!payload) {
          json(_res, 401, { message: "Token invalido ou expirado." });
          return;
        }

        json(_res, 200, issueTokens(String(payload.sub ?? "admin")));
      },
    },

    {
      method: "GET",
      pattern: /^\/v1\/pets\/?$/,
      handler: async (_req, _res) => {
        if (!requireAccessToken(_req, _res)) return;

        const store = await loadStore();
        const nome = getQueryValue(_req.query?.nome as any)?.toLowerCase();
        const raca = getQueryValue(_req.query?.raca as any)?.toLowerCase();
        const page = getNumberQuery(_req.query?.page as any, 0);
        const size = getNumberQuery(_req.query?.size as any, 10);

        const filtered = store.pets.filter((pet) => {
          const matchesNome = nome ? pet.nome.toLowerCase().includes(nome) : true;
          const matchesRaca = raca ? (pet.raca ?? "").toLowerCase().includes(raca) : true;
          return matchesNome && matchesRaca;
        });

        const total = filtered.length;
        const pageCount = size > 0 ? Math.ceil(total / size) : 1;
        const start = page * size;
        const content = size > 0 ? filtered.slice(start, start + size) : filtered;

        json(_res, 200, { page, size, total, pageCount, content: content.map(toPetResponse) });
      },
    },
    {
      method: "POST",
      pattern: /^\/v1\/pets\/?$/,
      handler: async (_req, _res) => {
        if (!requireAccessToken(_req, _res)) return;

        const body = await parseJson<{ nome?: string; raca?: string; idade?: number }>(_req);
        if (!body?.nome) {
          json(_res, 400, { message: "Nome obrigatorio." });
          return;
        }

        const store = await loadStore();
        const pet = {
          id: store.nextPetId++,
          nome: body.nome,
          raca: body.raca,
          idade: body.idade,
          foto: undefined,
          tutores: [],
        };

        store.pets.push(pet);
        await saveStore(store);

        json(_res, 201, toPetResponse(pet));
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/pets\/(?<id>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const store = await loadStore();
        const pet = store.pets.find((item) => item.id === id);
        if (!pet) {
          json(_res, 404, { message: "Pet nao encontrado." });
          return;
        }

        const tutores = store.tutores.filter((t) => pet.tutores.includes(t.id)).map(toTutorResponse);

        json(_res, 200, { ...toPetResponse(pet), tutores });
      },
    },
    {
      method: "PUT",
      pattern: /^\/v1\/pets\/(?<id>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const body = await parseJson<{ nome?: string; raca?: string; idade?: number }>(_req);
        if (!body?.nome) {
          json(_res, 400, { message: "Nome obrigatorio." });
          return;
        }

        const id = Number(params.id);
        const store = await loadStore();
        const pet = store.pets.find((item) => item.id === id);
        if (!pet) {
          json(_res, 404, { message: "Pet nao encontrado." });
          return;
        }

        pet.nome = body.nome;
        pet.raca = body.raca;
        pet.idade = body.idade;

        await saveStore(store);
        json(_res, 200, toPetResponse(pet));
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v1\/pets\/(?<id>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const store = await loadStore();
        const petIndex = store.pets.findIndex((item) => item.id === id);
        if (petIndex === -1) {
          json(_res, 404, { message: "Pet nao encontrado." });
          return;
        }

        const [removed] = store.pets.splice(petIndex, 1);
        store.tutores.forEach((t) => {
          t.pets = t.pets.filter((petId) => petId !== removed.id);
        });

        await saveStore(store);
        noContent(_res);
      },
    },
    {
      method: "POST",
      pattern: /^\/v1\/pets\/(?<id>[^/]+)\/fotos\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const store = await loadStore();
        const pet = store.pets.find((item) => item.id === id);
        if (!pet) {
          json(_res, 404, { message: "Pet nao encontrado." });
          return;
        }

        const file = await parseSingleFile(_req, "foto");
        if (!file) {
          json(_res, 400, { message: "Arquivo obrigatorio." });
          return;
        }

        const fotoId = store.nextFotoId++;
        const blob = await putPublic(`imagens/pets/${id}/${fotoId}-${file.filename}`, file.buffer, file.mimeType);

        const anexo = { id: fotoId, nome: file.filename, contentType: file.mimeType, url: blob.url };
        pet.foto = anexo;
        await saveStore(store);

        json(_res, 201, anexo);
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v1\/pets\/(?<id>[^/]+)\/fotos\/(?<fotoId>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const fotoId = Number(params.fotoId);
        const store = await loadStore();
        const pet = store.pets.find((item) => item.id === id);
        if (!pet || !pet.foto || pet.foto.id !== fotoId) {
          json(_res, 404, { message: "Foto nao encontrada." });
          return;
        }

        await delByUrl(pet.foto.url);
        pet.foto = undefined;
        await saveStore(store);

        noContent(_res);
      },
    },

    {
      method: "GET",
      pattern: /^\/v1\/tutores\/?$/,
      handler: async (_req, _res) => {
        if (!requireAccessToken(_req, _res)) return;

        const store = await loadStore();
        const nome = getQueryValue(_req.query?.nome as any)?.toLowerCase();
        const page = getNumberQuery(_req.query?.page as any, 0);
        const size = getNumberQuery(_req.query?.size as any, 10);

        const filtered = store.tutores.filter((tutor) => {
          if (!nome) return true;
          return tutor.nome.toLowerCase().includes(nome);
        });

        const total = filtered.length;
        const pageCount = size > 0 ? Math.ceil(total / size) : 1;
        const start = page * size;
        const content = size > 0 ? filtered.slice(start, start + size) : filtered;

        json(_res, 200, { page, size, total, pageCount, content: content.map(toTutorResponse) });
      },
    },
    {
      method: "POST",
      pattern: /^\/v1\/tutores\/?$/,
      handler: async (_req, _res) => {
        if (!requireAccessToken(_req, _res)) return;

        const body = await parseJson<{ nome?: string; email?: string; telefone?: string; endereco?: string; cpf?: number }>(_req);
        if (!body?.nome || !body.telefone) {
          json(_res, 400, { message: "Nome e telefone obrigatorios." });
          return;
        }

        const store = await loadStore();
        const tutor = {
          id: store.nextTutorId++,
          nome: body.nome,
          email: body.email,
          telefone: body.telefone,
          endereco: body.endereco,
          cpf: body.cpf,
          foto: undefined,
          pets: [],
        };

        store.tutores.push(tutor);
        await saveStore(store);

        json(_res, 201, toTutorResponse(tutor));
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const store = await loadStore();
        const tutor = store.tutores.find((item) => item.id === id);
        if (!tutor) {
          json(_res, 404, { message: "Tutor nao encontrado." });
          return;
        }

        const pets = store.pets.filter((pet) => tutor.pets.includes(pet.id)).map(toPetResponse);
        json(_res, 200, { ...toTutorResponse(tutor), pets });
      },
    },
    {
      method: "PUT",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const body = await parseJson<{ nome?: string; email?: string; telefone?: string; endereco?: string; cpf?: number }>(_req);
        if (!body?.nome || !body.telefone) {
          json(_res, 400, { message: "Nome e telefone obrigatorios." });
          return;
        }

        const id = Number(params.id);
        const store = await loadStore();
        const tutor = store.tutores.find((item) => item.id === id);
        if (!tutor) {
          json(_res, 404, { message: "Tutor nao encontrado." });
          return;
        }

        tutor.nome = body.nome;
        tutor.email = body.email;
        tutor.telefone = body.telefone;
        tutor.endereco = body.endereco;
        tutor.cpf = body.cpf;

        await saveStore(store);
        json(_res, 200, toTutorResponse(tutor));
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const store = await loadStore();
        const tutorIndex = store.tutores.findIndex((item) => item.id === id);
        if (tutorIndex === -1) {
          json(_res, 404, { message: "Tutor nao encontrado." });
          return;
        }

        const [removed] = store.tutores.splice(tutorIndex, 1);
        store.pets.forEach((pet) => {
          pet.tutores = pet.tutores.filter((tutorId) => tutorId !== removed.id);
        });

        await saveStore(store);
        noContent(_res);
      },
    },
    {
      method: "POST",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/fotos\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const store = await loadStore();
        const tutor = store.tutores.find((item) => item.id === id);
        if (!tutor) {
          json(_res, 404, { message: "Tutor nao encontrado." });
          return;
        }

        const file = await parseSingleFile(_req, "foto");
        if (!file) {
          json(_res, 400, { message: "Arquivo obrigatorio." });
          return;
        }

        const fotoId = store.nextFotoId++;
        const blob = await putPublic(`imagens/tutores/${id}/${fotoId}-${file.filename}`, file.buffer, file.mimeType);

        const anexo = { id: fotoId, nome: file.filename, contentType: file.mimeType, url: blob.url };
        tutor.foto = anexo;
        await saveStore(store);

        json(_res, 201, anexo);
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/fotos\/(?<fotoId>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const id = Number(params.id);
        const fotoId = Number(params.fotoId);
        const store = await loadStore();
        const tutor = store.tutores.find((item) => item.id === id);
        if (!tutor || !tutor.foto || tutor.foto.id !== fotoId) {
          json(_res, 404, { message: "Foto nao encontrada." });
          return;
        }

        await delByUrl(tutor.foto.url);
        tutor.foto = undefined;
        await saveStore(store);

        noContent(_res);
      },
    },
    {
      method: "POST",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/pets\/(?<petId>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const tutorId = Number(params.id);
        const petId = Number(params.petId);
        const store = await loadStore();
        const tutor = store.tutores.find((t) => t.id === tutorId);
        const pet = store.pets.find((p) => p.id === petId);

        if (!tutor || !pet) {
          json(_res, 404, { message: "Pet ou tutor nao encontrado." });
          return;
        }

        if (!tutor.pets.includes(petId)) tutor.pets.push(petId);
        if (!pet.tutores.includes(tutorId)) pet.tutores.push(tutorId);

        await saveStore(store);
        _res.status(201).end();
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v1\/tutores\/(?<id>[^/]+)\/pets\/(?<petId>[^/]+)\/?$/,
      handler: async (_req, _res, params) => {
        if (!requireAccessToken(_req, _res)) return;

        const tutorId = Number(params.id);
        const petId = Number(params.petId);
        const store = await loadStore();
        const tutor = store.tutores.find((t) => t.id === tutorId);
        const pet = store.pets.find((p) => p.id === petId);

        if (!tutor || !pet) {
          json(_res, 404, { message: "Pet ou tutor nao encontrado." });
          return;
        }

        tutor.pets = tutor.pets.filter((id) => id !== petId);
        pet.tutores = pet.tutores.filter((id) => id !== tutorId);

        await saveStore(store);
        noContent(_res);
      },
    },
  ];

  const m = match(routes, method, pathname);
  if (!m) {
    json(res, 404, { message: "Not Found" });
    return;
  }

  // Named params
  const namedParams = (pathname.match(m.route.pattern)?.groups ?? {}) as Record<string, string>;
  await m.route.handler(req, res, namedParams);
}
