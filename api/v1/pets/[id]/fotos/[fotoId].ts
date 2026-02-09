import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../../../_lib/auth";
import { delByUrl } from "../../../../_lib/blob";
import { getNumberQuery, json, methodNotAllowed, noContent } from "../../../../_lib/http";
import { loadStore, saveStore } from "../../../../_lib/store";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") {
    methodNotAllowed(res, ["DELETE"]);
    return;
  }

  if (!requireAccessToken(req, res)) {
    return;
  }

  const id = getNumberQuery(req.query.id, -1);
  const fotoId = getNumberQuery(req.query.fotoId, -1);
  const store = await loadStore();
  const pet = store.pets.find((item) => item.id === id);
  if (!pet || !pet.foto || pet.foto.id !== fotoId) {
    json(res, 404, { message: "Foto nao encontrada." });
    return;
  }

  await delByUrl(pet.foto.url);
  pet.foto = undefined;
  await saveStore(store);

  noContent(res);
}
