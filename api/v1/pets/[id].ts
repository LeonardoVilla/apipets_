import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../_lib/auth";
import { getNumberQuery, json, methodNotAllowed, noContent, parseJson } from "../../_lib/http";
import { toPetResponse, toTutorResponse } from "../../_lib/model";
import { loadStore, saveStore } from "../../_lib/store";

type PetRequestDto = {
  nome?: string;
  raca?: string;
  idade?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = getNumberQuery(req.query.id, -1);

  if (req.method === "GET") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const store = await loadStore();
    const pet = store.pets.find((item) => item.id === id);
    if (!pet) {
      json(res, 404, { message: "Pet nao encontrado." });
      return;
    }

    const tutores = store.tutores
      .filter((tutor) => pet.tutores.includes(tutor.id))
      .map(toTutorResponse);

    json(res, 200, {
      ...toPetResponse(pet),
      tutores,
    });
    return;
  }

  if (req.method === "PUT") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const body = await parseJson<PetRequestDto>(req);
    if (!body?.nome) {
      json(res, 400, { message: "Nome obrigatorio." });
      return;
    }

    const store = await loadStore();
    const pet = store.pets.find((item) => item.id === id);
    if (!pet) {
      json(res, 404, { message: "Pet nao encontrado." });
      return;
    }

    pet.nome = body.nome;
    pet.raca = body.raca;
    pet.idade = body.idade;

    await saveStore(store);
    json(res, 200, toPetResponse(pet));
    return;
  }

  if (req.method === "DELETE") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const store = await loadStore();
    const petIndex = store.pets.findIndex((item) => item.id === id);
    if (petIndex === -1) {
      json(res, 404, { message: "Pet nao encontrado." });
      return;
    }

    const [removed] = store.pets.splice(petIndex, 1);
    store.tutores.forEach((tutor) => {
      tutor.pets = tutor.pets.filter((petId) => petId !== removed.id);
    });

    await saveStore(store);
    noContent(res);
    return;
  }

  methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
}
