import { NextResponse, type NextRequest } from "next/server";

import { loadBuyerSession, SPENT_COOKIE } from "@/lib/buyers/access";
import { FUNCTION_BODY_BYTES } from "@/lib/buyers/constants";
import { inspectUpload, safeFileName, slotById } from "@/lib/buyers/documents";
import { BuyersError } from "@/lib/buyers/errors";
import { addBuyerDocument, registerBuyerBlob, removeBuyerDocument } from "@/lib/buyers/service";
import { allowRequest, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(error: unknown) {
  if (error instanceof BuyersError) {
    return json({ error: error.message, reason: error.reason ?? "" }, error.status);
  }
  console.error("Buyers upload failed", error instanceof Error ? error.name : "error");
  return json({ error: "The file could not be stored." }, 500);
}

export async function POST(request: NextRequest) {
  try {
    if (!allowRequest(`buyers-upload:${clientIp(request)}`, 40, 15 * 60 * 1000)) {
      return json({ error: "Too many uploads. Wait a few minutes and try again." }, 429);
    }
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const token = typeof body?.t === "string" ? body.t : "";
      if (token.length < 20 || token.length > 4000) {
        return json({ error: "This link is not valid." }, 401);
      }
      const session = await loadBuyerSession(token, request.cookies.get(SPENT_COOKIE)?.value);
      if (!session.ok || session.status !== "active") {
        return json({ error: "This link is not active." }, 401);
      }
      if (body?.action !== "register") return json({ error: "That action is not recognized." }, 400);
      const file = await registerBuyerBlob({
        grantId: session.grantId,
        slot: typeof body.slot === "string" ? body.slot : "",
        fileName: safeFileName(typeof body.fileName === "string" ? body.fileName : ""),
        contentType: typeof body.contentType === "string" ? body.contentType : "application/octet-stream",
        byteSize: typeof body.byteSize === "number" ? body.byteSize : 0,
        pathname: typeof body.pathname === "string" ? body.pathname : "",
        consent: body.consent === true,
      });
      return json({ ok: true, file });
    }
    const form = await request.formData();
    const token = form.get("t");
    if (typeof token !== "string" || token.length < 20 || token.length > 4000) {
      return json({ error: "This link is not valid." }, 401);
    }
    const session = await loadBuyerSession(
      token,
      request.cookies.get(SPENT_COOKIE)?.value,
    );
    if (!session.ok) {
      return json({ error: "This link is not active.", reason: session.reason }, 401);
    }
    if (session.status !== "active") {
      return json({ error: "This one-time link has already been used.", reason: "spent" }, 401);
    }
    const action = form.get("action");
    const slot = form.get("slot");
    if (action === "remove") {
      const fileId = form.get("fileId");
      if (typeof fileId !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(fileId)) {
        return json({ error: "That file was not found." }, 400);
      }
      await removeBuyerDocument(session.grantId, fileId);
      return json({ ok: true });
    }
    if (action !== "upload") {
      return json({ error: "That action is not recognized." }, 400);
    }
    if (form.get("consent") !== "yes") {
      return json(
        { error: "Confirm the consent line before uploading.", reason: "consent" },
        400,
      );
    }
    if (typeof slot !== "string" || !slotById(slot)) {
      return json({ error: "That document slot is not recognized." }, 400);
    }
    const incoming = form.get("file");
    if (!(incoming instanceof File)) {
      return json({ error: "Choose a file to upload." }, 400);
    }
    if (incoming.size > FUNCTION_BODY_BYTES) {
      return json(
        {
          error: `${incoming.name} is too large to send through the form. Use the direct upload, which allows 50 MB.`,
        },
        413,
      );
    }
    const bytes = new Uint8Array(await incoming.arrayBuffer());
    const inspected = inspectUpload(incoming.name, incoming.type, bytes);
    if (!inspected.ok) return json({ error: inspected.error }, 400);
    const file = await addBuyerDocument({
      grantId: session.grantId,
      slot,
      fileName: inspected.fileName,
      contentType: inspected.contentType,
      bytes,
      consent: true,
    });
    return json({ ok: true, file });
  } catch (error) {
    return fail(error);
  }
}
