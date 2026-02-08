import type { VercelRequest } from "@vercel/node";
import Busboy from "busboy";

type FileResult = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export function parseSingleFile(req: VercelRequest, fieldName: string) {
  return new Promise<FileResult | null>((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const chunks: Buffer[] = [];
    let filename = "";
    let mimeType = "application/octet-stream";
    let hasFile = false;

    busboy.on("file", (name, file, info) => {
      if (name !== fieldName) {
        file.resume();
        return;
      }

      hasFile = true;
      filename = info.filename ?? "upload";
      mimeType = info.mimeType ?? "application/octet-stream";

      file.on("data", (data) => {
        chunks.push(Buffer.from(data));
      });
    });

    busboy.on("finish", () => {
      if (!hasFile) {
        resolve(null);
        return;
      }
      resolve({ buffer: Buffer.concat(chunks), filename, mimeType });
    });

    busboy.on("error", (err) => {
      reject(err);
    });

    req.pipe(busboy);
  });
}
