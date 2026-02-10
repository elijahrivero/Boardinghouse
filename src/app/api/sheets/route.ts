import { NextResponse } from "next/server";
import { google } from "googleapis";
import type { TenantBalance, TenantPaymentStatus } from "@/types";

function parsePaymentStatus(s: string): TenantPaymentStatus {
  const lower = (s || "").toLowerCase();
  if (lower.includes("paid")) return "paid";
  if (lower.includes("due soon") || lower.includes("duesoon")) return "due_soon";
  if (lower.includes("overdue")) return "overdue";
  return "due_soon";
}

export async function GET(request: Request) {
  const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentials || !sheetId) {
    return NextResponse.json(
      { error: "Google Sheets not configured. Add GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID to .env.local" },
      { status: 503 }
    );
  }

  try {
    const cred = JSON.parse(credentials);
    const auth = new google.auth.GoogleAuth({
      credentials: cred,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "TenantBalance!A2:H",
    });

    const rows = res.data.values || [];
    const tenants: TenantBalance[] = rows.map((row, i) => {
      const monthlyRent = Number(row[3] ?? 0) || 0;
      const amountPaid = Number(row[4] ?? 0) || 0;
      const rawBalance = Number(row[5]);
      const remainingBalance = !isNaN(rawBalance) ? rawBalance : Math.max(0, monthlyRent - amountPaid);
      const statusStr = String(row[6] ?? "").trim();
      const computedStatus: TenantPaymentStatus =
        remainingBalance <= 0
          ? "paid"
          : statusStr
            ? parsePaymentStatus(statusStr)
            : "due_soon";
      return {
        id: `t-${i}`,
        tenantName: String(row[0] ?? ""),
        roomNumber: String(row[1] ?? ""),
        bedNumber: String(row[2] ?? ""),
        monthlyRent,
        amountPaid,
        remainingBalance: Math.max(0, remainingBalance),
        status: computedStatus,
      };
    });
    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Sheets API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Google Sheets" },
      { status: 500 }
    );
  }
}
