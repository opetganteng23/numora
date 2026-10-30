import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Health check untuk nginx, PM2, dan monitoring. Sengaja tidak menyentuh database. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "numora" });
}
