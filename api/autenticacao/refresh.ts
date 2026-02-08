import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerToken, issueTokens, verifyRefreshToken } from "../_lib/auth";
import { json, methodNotAllowed } from "../_lib/http";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") {
    methodNotAllowed(res, ["PUT"]);
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { message: "Token ausente." });
    return;
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    json(res, 401, { message: "Token invalido ou expirado." });
    return;
  }

  json(res, 200, issueTokens(String(payload.sub ?? "admin")));
}
