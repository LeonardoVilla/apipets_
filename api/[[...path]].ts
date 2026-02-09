import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const mod = await import("../server/router");
    await mod.handleApi(req, res);
  } catch (err) {
    // Avoid crashing the invocation; return a standard 500 payload.
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(500).send({ message: "Erro interno.", detail: String(err) });
      return;
    }
    res.end();
  }
}
