import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAccessToken } from "../../_lib/auth";
import { getNumberQuery, getQueryValue, json, methodNotAllowed, parseJson } from "../../_lib/http";
import { toTutorResponse } from "../../_lib/model";
import { loadStore, saveStore } from "../../_lib/store";

type TutorRequestDto = {
  nome?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cpf?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const body = await parseJson<TutorRequestDto>(req);
    if (!body?.nome || !body.telefone) {
      json(res, 400, { message: "Nome e telefone obrigatorios." });
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

    json(res, 201, toTutorResponse(tutor));
    return;
  }

  if (req.method === "GET") {
    if (!requireAccessToken(req, res)) {
      return;
    }

    const store = await loadStore();
    const nome = getQueryValue(req.query.nome)?.toLowerCase();
    const page = getNumberQuery(req.query.page, 0);
    const size = getNumberQuery(req.query.size, 10);

    const filtered = store.tutores.filter((tutor) => {
      if (!nome) {
        return true;
      }
      return tutor.nome.toLowerCase().includes(nome);
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
      content: content.map(toTutorResponse),
    });
    return;
  }

  methodNotAllowed(res, ["POST", "GET"]);
}
