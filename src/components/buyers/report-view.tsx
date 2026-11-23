"use client";

import { Wordmark } from "@/components/wordmark";
import { BAND_META } from "@/lib/buyers/copy";
import { documentStatusLabel, type BuyerReport } from "@/lib/buyers/report";
import { site } from "@/lib/site";

export function ReportView({
  report,
  emailed,
  linkStatus,
  onAnother,
}: {
  report: BuyerReport;
  emailed: boolean | null;
  linkStatus: "active" | "spent" | null;
  onAnother?: () => void;
}) {
  const overall = BAND_META[report.overallBand];
  const prepared = new Date(report.createdAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <article className="buyers-report mt-8">
      <style>{`
        @media print {
          header, footer, .print-hidden { display: none !important; }
          body { background: #fff !important; }
          .buyers-report { color: #111; }
        }
      `}</style>
      <div className="flex items-start justify-between gap-4">
        <Wordmark variant="mark" className="h-12" />
        <p className="text-right text-xs text-navy/55">
          Buyers Health Check
          <br />
          {prepared} ET
        </p>
      </div>
      <p className="mt-6 text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
        Checklist and guidance
      </p>
      <h2 className="font-heading mt-2 text-3xl text-navy">{report.associationName}</h2>
      <p className="mt-2 text-sm text-navy/70">
        {report.unitAddress ? `${report.unitAddress} · ` : ""}
        {report.stateName}
      </p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-navy/50">{report.completer}</dt>
          <dd>
            {report.personName}
            <br />
            {report.personEmail}
          </dd>
        </div>
        <div>
          <dt className="text-navy/50">Report reference</dt>
          <dd>{report.id}</dd>
        </div>
        <div>
          <dt className="text-navy/50">3 or more stories</dt>
          <dd>{report.stories3}</dd>
        </div>
      </dl>
      {report.agentLine ? (
        <p className="mt-4 text-sm text-navy">Subscription agent: {report.agentLine}</p>
      ) : null}
      {report.typedAgentLine ? (
        <p className="mt-2 text-sm text-navy/75">Agent named on the form: {report.typedAgentLine}</p>
      ) : null}
      {report.overCap ? (
        <p className="mt-4 rounded-md border border-[#9a3412]/30 bg-[#fff1e6] p-4 text-sm text-[#9a3412]">
          This subscription is past its courtesy volume of {report.monthlyCap} reports
          this month. The report was still produced. TBC may follow up.
        </p>
      ) : null}

      <p
        className="mt-6 inline-flex items-center gap-3 rounded-md px-4 py-3 text-sm"
        style={{ background: overall.surface, color: overall.swatch }}
      >
        <span className="font-medium">
          {overall.light}: {overall.label}
        </span>
        <span>
          {report.findings.length} not in hand of {report.total}
        </span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-navy/75">{report.summary}</p>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Risk findings</h3>
        {report.findings.length === 0 ? (
          <p className="mt-3 text-sm text-navy/70">
            Nothing was marked &quot;I don&apos;t have this.&quot; Attached files still need a
            human reading. This check does not open them.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {report.findings.map((finding) => (
              <li key={finding.id} className="break-inside-avoid border-t border-navy/10 pt-3 text-sm">
                <p className="font-medium text-navy">{finding.title}</p>
                <p className="mt-1 leading-relaxed text-navy/80">{finding.text}</p>
                {finding.note ? <p className="mt-1 text-navy/60">Note: {finding.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.notApplicable.length > 0 ? (
        <section className="mt-8">
          <h3 className="font-heading text-2xl text-navy">Doesn&apos;t apply</h3>
          <p className="mt-2 text-sm text-navy/65">
            These are not risk findings and they are not on the request list.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-navy/80">
            {report.notApplicable.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Documents to request before closing</h3>
        {report.requests.length === 0 ? (
          <p className="mt-3 text-sm text-navy/70">
            Every checklist item was attached. Still confirm the estoppel date and
            any amount due before you schedule closing.
          </p>
        ) : (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-navy/85">
            {report.requests.map((item) => (
              <li key={item.title}>
                <span className="font-medium text-navy">{item.title}.</span> {item.ask}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Guidance for what was attached</h3>
        <ul className="mt-4 space-y-4">
          {report.attachedNotes.map((item) => (
            <li key={item.id} className="break-inside-avoid border-t border-navy/10 pt-3 text-sm">
              <p className="font-medium text-navy">
                {item.title}
                {item.files.length > 0 ? ` (${item.files.join(", ")})` : ""}
              </p>
              <p className="mt-1 leading-relaxed text-navy/80">{item.text}</p>
              {item.note ? <p className="mt-1 text-navy/60">Note: {item.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Checklist record</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {report.documents.map((doc) => (
            <li key={doc.slot} className="border-t border-navy/10 pt-2">
              <span className="text-navy">{doc.title}</span>
              <span className="text-navy/60"> · {documentStatusLabel(doc.status)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm leading-relaxed text-navy/75">{report.disclaimer}</p>
      <p className="mt-3 text-sm text-navy/60">
        {emailed
          ? "A copy of this summary was sent to TBC Advisory. Save a PDF from the print dialog for your own file."
          : `A copy was not emailed from this deployment. Use the print dialog to save a PDF, and contact ${site.email} if you need TBC to keep one.`}
      </p>
      {linkStatus === "spent" ? (
        <p className="mt-3 text-sm text-navy/70">
          This one-time link is now spent. Another property needs a new link.
        </p>
      ) : null}

      <div className="print-hidden mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="h-11 rounded-md bg-primary px-4 text-sm text-white"
          onClick={() => window.print()}
        >
          Print or save as PDF
        </button>
        {onAnother ? (
          <button
            type="button"
            className="h-11 rounded-md border border-navy/20 px-4 text-sm"
            onClick={onAnother}
          >
            Start another property
          </button>
        ) : null}
      </div>
    </article>
  );
}
