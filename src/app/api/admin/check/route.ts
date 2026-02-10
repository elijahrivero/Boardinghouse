import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "crypto";

const COOKIE_NAME = "admin_session";

function signToken(payload: string): string {
  const secret = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || "fallback-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
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

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}
