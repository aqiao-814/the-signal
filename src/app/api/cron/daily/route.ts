import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { runDailyPipeline } from "@/server/pipeline";
import { scheduledWindow } from "@/server/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger("cron:daily");

function authorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  return auth === `Bearer ${env.CRON_SECRET}` || key === env.CRON_SECRET;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const result = await runDailyPipeline({
      window: dateParam ? scheduledWindow(new Date(dateParam)) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("daily cron failed", { error: (err as Error).message });
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
