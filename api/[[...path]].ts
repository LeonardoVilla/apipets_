import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApi } from "../server/router";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleApi(req, res);
}
