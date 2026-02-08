import type { VercelRequest, VercelResponse } from "@vercel/node";
import { issueTokens } from "../_lib/auth";
import { json, methodNotAllowed, parseJson } from "../_lib/http";

type AuthRequestDto = {
  username?: string;
  password?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await parseJson<AuthRequestDto>(req);
  const username = body?.username ?? "";
  const password = body?.password ?? "";

  if (username !== "admin" || password !== "admin") {
    json(res, 401, { message: "Credenciais invalidas." });
    return;
  }

  json(res, 200, issueTokens("admin"));
}
