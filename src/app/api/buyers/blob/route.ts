import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";

import { MAX_FILE_BYTES } from "@/lib/buyers/constants";
import { slotById } from "@/lib/buyers/documents";
import { blobAuth } from "@/lib/buyers/store";
import { verifyToken } from "@/lib/buyers/token";

export const runtime = "nodejs";

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as HandleUploadPresignedBody | null;
  if (!body) return json({ error: "The upload request was not valid." }, 400);
  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || "{}") as {
          t?: string;
          slot?: string;
        };
        const token = typeof payload.t === "string" ? payload.t : "";
        const session = verifyToken(token);
        if (!session || session.exp * 1000 < Date.now()) {
          throw new Error("This link is not valid.");
        }
        if (!slotById(payload.slot ?? "")) {
          throw new Error("That document slot is not recognized.");
        }
        const prefix = `buyers/docs/${session.id}/`;
        if (!pathname.startsWith(prefix) || pathname.includes("..")) {
          throw new Error("That file name was rejected.");
        }
        const issued = await issueSignedToken({
          pathname,
          operations: ["put"],
          maximumSizeInBytes: MAX_FILE_BYTES,
          allowedContentTypes: ALLOWED,
          ...blobAuth(),
        });
        return {
          token: issued,
          urlOptions: {
            maximumSizeInBytes: MAX_FILE_BYTES,
            allowedContentTypes: ALLOWED,
            addRandomSuffix: false,
            allowOverwrite: false,
            ttlDays: 1,
          },
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const missing = message.includes("No blob") || message.includes("No read-write") || message.includes("OIDC");
    console.error("Buyers upload token failed", error instanceof Error ? error.name : "error");
    return json(
      {
        error: missing
          ? "Private file storage is not connected on this preview."
          : "The upload could not be started.",
      },
      missing ? 503 : 400,
    );
  }
}
