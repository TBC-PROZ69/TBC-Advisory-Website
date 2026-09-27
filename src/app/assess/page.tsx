import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssessApp } from "@/components/assess/assess-app";
import { assessMetadata } from "@/lib/seo";

export const metadata: Metadata = assessMetadata();

export const dynamic = "force-dynamic";

export default async function AssessPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const params = await searchParams;
  const required = process.env.ASSESS_ACCESS_KEY;
  if (required && params.k !== required) {
    notFound();
  }

  return <AssessApp accessKey={params.k} />;
}
