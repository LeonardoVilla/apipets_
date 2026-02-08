import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../_lib/auth";
import { getNumberQuery, json, methodNotAllowed, noContent, parseJson } from "../../_lib/http";
import { toPetResponse, toTutorResponse } from "../../_lib/model";
import { loadStore, saveStore } from "../../_lib/store";

type TutorRequestDto = {
  nome?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cpf?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = getNumberQuery(req.query.id, -1);

  if (req.method === "GET") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const store = await loadStore();
    const tutor = store.tutores.find((item) => item.id === id);
    if (!tutor) {
      json(res, 404, { message: "Tutor nao encontrado." });
      return;
    }

    const pets = store.pets
      .filter((pet) => tutor.pets.includes(pet.id))
      .map(toPetResponse);

    json(res, 200, {
      ...toTutorResponse(tutor),
      pets,
    });
    return;
  }

  if (req.method === "PUT") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const body = await parseJson<TutorRequestDto>(req);
    if (!body?.nome || !body.telefone) {
      json(res, 400, { message: "Nome e telefone obrigatorios." });
      return;
    }

    const store = await loadStore();
    const tutor = store.tutores.find((item) => item.id === id);
    if (!tutor) {
      json(res, 404, { message: "Tutor nao encontrado." });
      return;
    }

    tutor.nome = body.nome;
    tutor.email = body.email;
    tutor.telefone = body.telefone;
    tutor.endereco = body.endereco;
    tutor.cpf = body.cpf;

    await saveStore(store);
    json(res, 200, toTutorResponse(tutor));
    return;
  }

  if (req.method === "DELETE") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const store = await loadStore();
    const tutorIndex = store.tutores.findIndex((item) => item.id === id);
    if (tutorIndex === -1) {
      json(res, 404, { message: "Tutor nao encontrado." });
      return;
    }

    const [removed] = store.tutores.splice(tutorIndex, 1);
    store.pets.forEach((pet) => {
      pet.tutores = pet.tutores.filter((tutorId) => tutorId !== removed.id);
    });

    await saveStore(store);
    noContent(res);
    return;
  }

  methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
}
