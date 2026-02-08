import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../_lib/auth";
import { getNumberQuery, getQueryValue, json, methodNotAllowed, parseJson } from "../../_lib/http";
import { toPetResponse } from "../../_lib/model";
import { loadStore, saveStore } from "../../_lib/store";

type PetRequestDto = {
  nome?: string;
  raca?: string;
  idade?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const body = await parseJson<PetRequestDto>(req);
    if (!body?.nome) {
      json(res, 400, { message: "Nome obrigatorio." });
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

    json(res, 201, toPetResponse(pet));
    return;
  }

  if (req.method === "GET") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const store = await loadStore();
    const nome = getQueryValue(req.query.nome)?.toLowerCase();
    const raca = getQueryValue(req.query.raca)?.toLowerCase();
    const page = getNumberQuery(req.query.page, 0);
    const size = getNumberQuery(req.query.size, 10);

    const filtered = store.pets.filter((pet) => {
      const matchesNome = nome ? pet.nome.toLowerCase().includes(nome) : true;
      const matchesRaca = raca ? (pet.raca ?? "").toLowerCase().includes(raca) : true;
      return matchesNome && matchesRaca;
    });

    const total = filtered.length;
    const pageCount = size > 0 ? Math.ceil(total / size) : 1;
    const start = page * size;
    const content = size > 0 ? filtered.slice(start, start + size) : filtered;

    json(res, 200, {
      page,
      size,
      total,
      pageCount,
      content: content.map(toPetResponse),
    });
    return;
  }

  methodNotAllowed(res, ["POST", "GET"]);
}
