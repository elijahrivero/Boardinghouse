import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 24 * 60 * 60; // 24 hours

function signToken(payload: string): string {
  const secret = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || "fallback-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function createSessionToken(): string {
  const payload = JSON.stringify({
    t: Date.now(),
    exp: Date.now() + MAX_AGE * 1000,
    r: randomBytes(16).toString("hex"),
  });
  const encoded = Buffer.from(payload, "utf-8").toString("base64url");
  const sig = signToken(payload);
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): boolean {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return false;
    const payload = Buffer.from(encoded, "base64url").toString("utf-8");
    const parsed = JSON.parse(payload);
    if (parsed.exp < Date.now()) return false;
    return signToken(payload) === sig;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Admin not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.local." },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const u = (body.username ?? "").trim();
  const p = body.password ?? "";

  if (u !== username || p !== password) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
