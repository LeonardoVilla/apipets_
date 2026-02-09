import { del as vercelDel, put as vercelPut } from "@vercel/blob";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".local-data");
const UPLOADS_DIR = path.join(LOCAL_DATA_DIR, "uploads");

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function normalizeRelativePath(p: string) {
  const normalized = path.posix.normalize("/" + p).replace(/^\//, "");
  if (normalized.includes("..")) {
    const hashed = createHash("sha256").update(p).digest("hex");
    return `unsafe/${hashed}`;
  }
  return normalized;
}

export async function putPublic(pathname: string, buffer: Buffer, contentType: string) {
  if (hasBlobToken()) {
    const blob = await vercelPut(pathname, buffer, { access: "public", contentType });
    return { url: blob.url };
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  const rel = normalizeRelativePath(pathname);
  const diskPath = path.join(UPLOADS_DIR, rel);
  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, buffer);

  return { url: `/__uploads/${rel}` };
}

export async function delByUrl(url: string) {
  if (hasBlobToken()) {
    await vercelDel(url);
    return;
  }

  if (!url.startsWith("/__uploads/")) {
    return;
  }

  const rel = normalizeRelativePath(url.replace("/__uploads/", ""));
  const diskPath = path.join(UPLOADS_DIR, rel);
  if (!existsSync(diskPath)) {
    return;
  }

  await rm(diskPath, { force: true });
}
