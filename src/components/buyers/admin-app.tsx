"use client";

import { useEffect, useState } from "react";

import { Container } from "@/components/container";
import { WizardButton } from "@/components/buyers/wizard-button";
import {
  AGENT_MONTHLY_PRICE_USD,
  ONE_TIME_PRICE_USD,
} from "@/lib/buyers/constants";
import type { GrantKind, GrantStatus } from "@/lib/buyers/types";

type Health = {
  storage: "temporary-disk" | "private-blob";
  storageReady: boolean;
  durable: boolean;
  signing: "configured" | "temporary";
  admin: "keyed" | "preview";
  monthlyCap: number;
  prices: { oneTimeUsd: number; agentMonthlyUsd: number };
  fileTtlDays: number;
  deployment: "production" | "preview" | "local";
};

type AdminGrant = {
  id: string;
  kind: GrantKind;
  status: GrantStatus;
  createdAt: string;
  expiresAt: string;
  label: string;
  agentName: string;
  agentEmail: string;
  agentLicense: string;
  monthlyCap: number | null;
  reportsThisMonth: number;
  overCap: boolean;
  href: string;
  billing: { mode: string; priceUsd: number; interval: string };
};

export function AdminApp({
  accessKey,
  previewOpen,
}: {
  accessKey: string;
  previewOpen: boolean;
}) {
  const [health, setHealth] = useState<Health | null>(null);
  const [grants, setGrants] = useState<AdminGrant[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [oneTimeLabel, setOneTimeLabel] = useState("");
  const [agent, setAgent] = useState({
    name: "",
    email: "",
    license: "",
    label: "",
    monthlyCap: "",
  });

  async function reload() {
    const response = await fetch(
      `/api/buyers/admin/grants?k=${encodeURIComponent(accessKey)}`,
    );
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      health?: Health;
      grants?: AdminGrant[];
    } | null;
    if (!response.ok || !data?.grants || !data.health) {
      throw new Error(data?.error || "The link list could not be loaded.");
    }
    setHealth(data.health);
    setGrants(data.grants);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(
          `/api/buyers/admin/grants?k=${encodeURIComponent(accessKey)}`,
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          health?: Health;
          grants?: AdminGrant[];
        } | null;
        if (cancelled) return;
        if (!response.ok || !data?.grants || !data.health) {
          throw new Error(data?.error || "The link list could not be loaded.");
        }
        setHealth(data.health);
        setGrants(data.grants);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The link list could not be loaded.",
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessKey]);

  async function create(body: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/buyers/admin/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, k: accessKey }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      grant?: AdminGrant;
    } | null;
    if (!response.ok || !data?.grant) {
      throw new Error(data?.error || "The link could not be created.");
    }
    await reload();
    await copy(data.grant.href);
  }

  async function copy(href: string) {
    const url = `${window.location.origin}${href}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(href);
    } catch {
      setCopied("");
      setError(url);
    }
  }

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
        Internal
      </p>
      <h1 className="font-heading mt-3 text-3xl text-navy">Buyers Health Check links</h1>
      <p className="mt-3 text-sm leading-relaxed text-navy/70">
        One-time links produce a single report, then they are spent. Agent
        links stay on while the subscription is active. Planned prices, not
        charged on this screen: ${ONE_TIME_PRICE_USD} per report and $
        {AGENT_MONTHLY_PRICE_USD} per month. Billing is manual until Stripe is
        connected.
      </p>

      {previewOpen ? (
        <p className="mt-4 rounded-md border border-primary/30 bg-card p-4 text-sm leading-relaxed text-navy/80">
          This admin page is open because BUYERS_ADMIN_KEY is not set and this
          deployment is not production. Set that key before the site goes live.
          Do not share this preview address.
        </p>
      ) : null}
      {health?.signing === "temporary" ? (
        <p className="mt-4 rounded-md border border-navy/15 bg-card p-4 text-sm leading-relaxed text-navy/80">
          Link signing is using a temporary preview key that ships with the
          code. It is not a production secret. Set BUYERS_LINK_SECRET before
          going live so these links stop working in production.
        </p>
      ) : null}
      {health && health.storage !== "private-blob" ? (
        <p className="mt-4 rounded-md border border-navy/15 bg-card p-4 text-sm leading-relaxed text-navy/80">
          Document files and the link ledger are on temporary private disk for
          this server instance. A one-time link is also blocked in the same
          browser after a report, even if the instance changes. Revoke and the
          monthly count stick only while this instance keeps its disk. Before
          going live, connect a private Vercel Blob store and set
          BUYERS_STORAGE=blob. See BUYERS.md. Nothing here is given a public URL.
        </p>
      ) : null}
      {health && !health.storageReady ? (
        <p className="mt-4 text-sm text-destructive">
          BUYERS_STORAGE is set to blob, but the Blob credential is missing.
        </p>
      ) : null}

      <section className="mt-10 space-y-4 rounded-md border border-navy/10 bg-card p-5">
        <h2 className="font-heading text-2xl text-navy">One-time link</h2>
        <label className="block text-sm">
          Internal label, optional
          <input
            className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
            value={oneTimeLabel}
            onChange={(event) => setOneTimeLabel(event.target.value)}
          />
        </label>
        <WizardButton
          onPress={() =>
            void create({ kind: "one-time", label: oneTimeLabel }).catch((createError) =>
              setError(createError instanceof Error ? createError.message : "Create failed."),
            )
          }
        >
          Create one-time link
        </WizardButton>
      </section>

      <section className="mt-6 space-y-4 rounded-md border border-navy/10 bg-card p-5">
        <h2 className="font-heading text-2xl text-navy">Agent subscription link</h2>
        <p className="text-sm text-navy/70">
          Default courtesy cap: {health?.monthlyCap ?? "25"} reports a month.
          Reports past the cap are still produced. Leave the cap blank to use
          the default. Deactivate the link to stop it. The agent name is
          printed on every report.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Agent name
            <input
              className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
              value={agent.name}
              onChange={(event) => setAgent({ ...agent, name: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Agent email
            <input
              className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
              type="email"
              value={agent.email}
              onChange={(event) => setAgent({ ...agent, email: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Florida license number
            <input
              className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
              value={agent.license}
              placeholder="Example format only"
              onChange={(event) => setAgent({ ...agent, license: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Monthly cap override, optional
            <input
              className="mt-1 h-11 w-full rounded-md border border-input bg-white px-3"
              inputMode="numeric"
              value={agent.monthlyCap}
              onChange={(event) => setAgent({ ...agent, monthlyCap: event.target.value })}
            />
          </label>
        </div>
        <WizardButton
          onPress={() =>
            void create({
              kind: "agent",
              name: agent.name,
              email: agent.email,
              license: agent.license,
              label: agent.label,
              monthlyCap: agent.monthlyCap,
            }).catch((createError) =>
              setError(createError instanceof Error ? createError.message : "Create failed."),
            )
          }
        >
          Create agent link
        </WizardButton>
      </section>

      {error ? (
        <p role="alert" className="mt-4 break-all text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {copied ? (
        <p className="mt-4 text-sm text-navy/70">Copied the full link.</p>
      ) : null}

      <section className="mt-10 space-y-4">
        <h2 className="font-heading text-2xl text-navy">Links</h2>
        {grants.length === 0 ? (
          <p className="text-sm text-navy/60">No links stored on this instance yet.</p>
        ) : (
          grants.map((grant) => (
            <article key={grant.id} className="rounded-md border border-navy/10 bg-card p-4 text-sm">
              <p className="font-medium text-navy">
                {grant.kind === "agent" ? "Agent" : "One-time"} · {grant.status}
                {grant.overCap ? " · over courtesy cap" : ""}
              </p>
              <p className="mt-1 text-navy/80">{grant.label}</p>
              {grant.kind === "agent" ? (
                <p className="mt-1 text-navy/70">
                  {grant.agentName} · {grant.agentEmail} · license {grant.agentLicense}
                  <br />
                  {grant.reportsThisMonth} reports this month
                  {grant.monthlyCap ? ` · cap ${grant.monthlyCap}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-navy/70">
                  Expires {new Date(grant.expiresAt).toLocaleDateString("en-US")}
                </p>
              )}
              <p className="mt-1 text-navy/50">
                Planned {grant.billing.mode} price ${grant.billing.priceUsd}{" "}
                {grant.billing.interval === "month" ? "per month" : "once"}. Not charged.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <WizardButton variant="outline" onPress={() => void copy(grant.href)}>
                  Copy link
                </WizardButton>
                {grant.status === "active" ? (
                  <WizardButton
                    variant="outline"
                    onPress={() => {
                      if (!window.confirm("Turn this link off?")) return;
                      void fetch("/api/buyers/admin/grants", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          k: accessKey,
                          action: "revoke",
                          id: grant.id,
                        }),
                      })
                        .then(async (response) => {
                          if (!response.ok) {
                            const data = (await response.json().catch(() => null)) as {
                              error?: string;
                            } | null;
                            throw new Error(data?.error || "Revoke failed.");
                          }
                          await reload();
                        })
                        .catch((revokeError) =>
                          setError(
                            revokeError instanceof Error
                              ? revokeError.message
                              : "Revoke failed.",
                          ),
                        );
                    }}
                  >
                    Deactivate
                  </WizardButton>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
    </Container>
  );
}
