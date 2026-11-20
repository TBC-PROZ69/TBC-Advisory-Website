import type { Metadata } from "next";
import { cookies } from "next/headers";

import { BuyersApp } from "@/components/buyers/buyers-app";
import { Container } from "@/components/container";
import { loadBuyerSession, SPENT_COOKIE } from "@/lib/buyers/access";
import type { BuyerSessionView } from "@/lib/buyers/types";
import { buyersMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = buyersMetadata("Buyers Health Check");
export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const token = one((await searchParams).t)?.trim() ?? "";
  if (!token) {
    return (
      <Gate
        title="A private link is required"
        body="This Buyers Health Check opens only from a link issued by TBC Advisory. It is not listed on the public site."
      />
    );
  }

  let session;
  try {
    session = await loadBuyerSession(
      token,
      (await cookies()).get(SPENT_COOKIE)?.value,
    );
  } catch {
    session = { ok: false as const, reason: "unavailable" as const };
  }

  if (!session.ok) {
    const copy = {
      invalid: [
        "This link is not valid",
        "The address does not match a Buyers Health Check link.",
      ],
      expired: [
        "This link has expired",
        "Ask TBC Advisory for a new link if the purchase is still moving.",
      ],
      revoked: [
        "This link has been turned off",
        "The subscription or one-time link is no longer active.",
      ],
      unavailable: [
        "This link cannot be checked right now",
        "Try again shortly. If it continues, contact TBC Advisory.",
      ],
    }[session.reason];
    return <Gate title={copy[0]} body={copy[1]} />;
  }

  const view: BuyerSessionView = {
    grantId: session.grantId,
    kind: session.kind,
    status: session.status,
    agentName: session.agentName,
    agentEmail: session.agentEmail,
    agentLicense: session.agentLicense,
    overCap: session.overCap,
    monthlyCap: session.monthlyCap,
    reportsThisMonth: session.reportsThisMonth,
  };

  return (
    <BuyersApp
      token={token}
      session={view}
      allowSample={process.env.VERCEL_ENV !== "production"}
    />
  );
}

function Gate({ title, body }: { title: string; body: string }) {
  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
        Buyer screening
      </p>
      <h1 className="font-heading mt-3 text-4xl text-navy">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-navy/75">{body}</p>
      <p className="mt-4 text-sm text-navy/70">
        Contact{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${site.email}`}>
          {site.email}
        </a>
        .
      </p>
    </Container>
  );
}
