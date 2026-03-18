// Magic link auth — stores pending tokens in memory + disk
// Token is a signed JWT-like base64 blob: { userId, email, exp }

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const SECRET = process.env.AUTH_SECRET ?? 'fallback-secret';

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readTokens(): Record<string, { userId: string; email: string; exp: number }> {
  ensureDir();
  if (!fs.existsSync(TOKENS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return {}; }
}

function writeTokens(data: Record<string, { userId: string; email: string; exp: number }>) {
  ensureDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createMagicToken(userId: string, email: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = Date.now() + 15 * 60 * 1000; // 15 min
  const tokens = readTokens();
  tokens[token] = { userId, email, exp };
  writeTokens(tokens);
  // Also sign it so it can't be guessed
  const sig = sign(token);
  return `${token}.${sig}`;
}

export function verifyMagicToken(raw: string): { userId: string; email: string } | null {
  const [token, sig] = raw.split('.');
  if (!token || !sig) return null;
  if (sign(token) !== sig) return null;
  const tokens = readTokens();
  const entry = tokens[token];
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    delete tokens[token];
    writeTokens(tokens);
    return null;
  }
  // Consume token (one-time use)
  delete tokens[token];
  writeTokens(tokens);
  return { userId: entry.userId, email: entry.email };
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(raw: string): string | null {
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const { userId } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return userId ?? null;
  } catch {
    return null;
  }
}
