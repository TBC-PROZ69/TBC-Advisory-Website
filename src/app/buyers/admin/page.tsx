import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminApp } from "@/components/buyers/admin-app";
import { adminGate } from "@/lib/buyers/token";
import { buyersMetadata } from "@/lib/seo";

export const metadata: Metadata = buyersMetadata("Buyers link admin");
export const dynamic = "force-dynamic";

export default async function BuyersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string | string[] }>;
}) {
  const raw = (await searchParams).k;
  const key = Array.isArray(raw) ? raw[0] : raw;
  const gate = adminGate(key);
  if (gate === "deny") notFound();
  return <AdminApp accessKey={key ?? ""} previewOpen={gate === "preview"} />;
}
