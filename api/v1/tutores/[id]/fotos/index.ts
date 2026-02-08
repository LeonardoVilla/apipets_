import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import { requireAccessToken } from "../../../../_lib/auth";
import { getNumberQuery, json, methodNotAllowed } from "../../../../_lib/http";
import { parseSingleFile } from "../../../../_lib/multipart";
import { loadStore, saveStore } from "../../../../_lib/store";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  if (!requireAccessToken(req, res)) {
    return;
  }

  const id = getNumberQuery(req.query.id, -1);
  const store = await loadStore();
  const tutor = store.tutores.find((item) => item.id === id);
  if (!tutor) {
    json(res, 404, { message: "Tutor nao encontrado." });
    return;
  }

  const file = await parseSingleFile(req, "foto");
  if (!file) {
    json(res, 400, { message: "Arquivo obrigatorio." });
    return;
  }

  const fotoId = store.nextFotoId++;
  const path = `imagens/tutores/${id}/${fotoId}-${file.filename}`;
  const blob = await put(path, file.buffer, {
    contentType: file.mimeType,
    access: "public",
  });

  const anexo = {
    id: fotoId,
    nome: file.filename,
    contentType: file.mimeType,
    url: blob.url,
  };

  tutor.foto = anexo;
  await saveStore(store);

  json(res, 201, anexo);
}
