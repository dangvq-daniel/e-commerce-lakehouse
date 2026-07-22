import { databaseConfigured, requireDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseConfigured) {
    return Response.json({ status: "degraded", database: "not_configured" }, { status: 503 });
  }

  try {
    const db = requireDatabase();
    await db`SELECT 1`;
    return Response.json({ status: "ok", database: "connected" });
  } catch (error) {
    return Response.json(
      { status: "degraded", database: "unreachable", message: String(error) },
      { status: 503 },
    );
  }
}
