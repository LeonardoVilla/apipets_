import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { json } from "./http";

const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 86400;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

type TokenType = "access" | "refresh";

export function issueTokens(subject: string) {
  const access_token = signToken({ sub: subject }, ACCESS_TTL_SECONDS, "access");
  const refresh_token = signToken({ sub: subject }, REFRESH_TTL_SECONDS, "refresh");

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TTL_SECONDS,
    refresh_expires_in: REFRESH_TTL_SECONDS,
  };
}

export function requireAccessToken(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { message: "Authorization header missing." });
    return null;
  }

  const payload = verifyToken(token, "access");
  if (!payload) {
    json(res, 401, { message: "Invalid or expired token." });
    return null;
  }

  return payload;
}

export function verifyRefreshToken(token: string) {
  return verifyToken(token, "refresh");
}

function signToken(payload: jwt.JwtPayload, ttlSeconds: number, type: TokenType) {
  return jwt.sign({ ...payload, typ: type }, JWT_SECRET, { expiresIn: ttlSeconds });
}

function verifyToken(token: string, expectedType: TokenType) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (decoded.typ !== expectedType) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}
