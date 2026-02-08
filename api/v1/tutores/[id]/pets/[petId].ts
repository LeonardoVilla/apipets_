import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../../../_lib/auth";
import { getNumberQuery, json, methodNotAllowed, noContent } from "../../../../_lib/http";
import { loadStore, saveStore } from "../../../../_lib/store";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAccessToken(req, res)) {
    return;
  }

  const tutorId = getNumberQuery(req.query.id, -1);
  const petId = getNumberQuery(req.query.petId, -1);
  const store = await loadStore();

  const tutor = store.tutores.find((item) => item.id === tutorId);
  const pet = store.pets.find((item) => item.id === petId);

  if (!tutor || !pet) {
    json(res, 404, { message: "Pet ou tutor nao encontrado." });
    return;
  }

  if (req.method === "POST") {
    if (!tutor.pets.includes(petId)) {
      tutor.pets.push(petId);
    }
    if (!pet.tutores.includes(tutorId)) {
      pet.tutores.push(tutorId);
    }

    await saveStore(store);
    res.status(201).end();
    return;
  }

  if (req.method === "DELETE") {
    tutor.pets = tutor.pets.filter((id) => id !== petId);
    pet.tutores = pet.tutores.filter((id) => id !== tutorId);
    await saveStore(store);
    noContent(res);
    return;
  }

  methodNotAllowed(res, ["POST", "DELETE"]);
}
