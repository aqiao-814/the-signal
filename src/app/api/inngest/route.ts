import { serve } from "inngest/next";
import type { NextRequest } from "next/server";
import { inngest } from "@/server/inngest/client";
import { functions } from "@/server/inngest/functions";

// `serve()` types its method args for both the pages and app routers; cast to
// the clean App Router signature Next 15 expects. At runtime the app-router
// handlers only need the request.
const handler = serve({ client: inngest, functions }) as unknown as Record<
  "GET" | "POST" | "PUT",
  (req: NextRequest) => Promise<Response>
>;

export const { GET, POST, PUT } = handler;
