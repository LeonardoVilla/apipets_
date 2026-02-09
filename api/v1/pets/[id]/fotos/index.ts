import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../../../_lib/auth";
import { putPublic } from "../../../../_lib/blob";
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
  const pet = store.pets.find((item) => item.id === id);
  if (!pet) {
    json(res, 404, { message: "Pet nao encontrado." });
    return;
  }

  const file = await parseSingleFile(req, "foto");
  if (!file) {
    json(res, 400, { message: "Arquivo obrigatorio." });
    return;
  }

  const fotoId = store.nextFotoId++;
  const path = `imagens/pets/${id}/${fotoId}-${file.filename}`;
  const blob = await putPublic(path, file.buffer, file.mimeType);

  const anexo = {
    id: fotoId,
    nome: file.filename,
    contentType: file.mimeType,
    url: blob.url,
  };

  pet.foto = anexo;
  await saveStore(store);

  json(res, 201, anexo);
}
