/**
 * Available AI Providers API
 * GET /api/providers
 */

import { getAvailableProviders } from "@/lib/ai/factory";

export async function GET() {
  const providers = getAvailableProviders();
  return Response.json({ providers });
}
