import { handleSiteInquiry } from "@/lib/inquiry-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleSiteInquiry(request, "print");
}
