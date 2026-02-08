import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFile } from "node:fs/promises";
import { methodNotAllowed } from "./_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  const fileUrl = new URL("../openapi", import.meta.url);
  const content = await readFile(fileUrl, "utf8");
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.status(200).send(content);
}
