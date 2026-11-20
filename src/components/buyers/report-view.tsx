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
  const overall = report.overallBand ? BAND_META[report.overallBand] : null;
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
          .buyers-report a { color: #111; text-decoration: none; }
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
        Buyer screening
      </p>
      <h2 className="font-heading mt-2 text-3xl text-navy">
        {report.associationName}
      </h2>
      <p className="mt-2 text-sm text-navy/70">
        Unit {report.unit} · {report.statuteLabel} · {report.county} County
      </p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-navy/50">Buyer</dt>
          <dd>{report.buyerName}</dd>
        </div>
        <div>
          <dt className="text-navy/50">Completed by</dt>
          <dd>{report.completer}</dd>
        </div>
        <div>
          <dt className="text-navy/50">Planned use</dt>
          <dd>{report.usePlan}</dd>
        </div>
        <div>
          <dt className="text-navy/50">Report reference</dt>
          <dd>{report.id}</dd>
        </div>
      </dl>
      {report.agentLine ? (
        <p className="mt-4 text-sm text-navy">
          Subscription agent: {report.agentLine}
        </p>
      ) : null}
      {report.typedAgentLine ? (
        <p className="mt-2 text-sm text-navy/75">
          Agent named on the form: {report.typedAgentLine}
        </p>
      ) : null}
      {report.overCap ? (
        <p className="mt-4 rounded-md border border-[#9a3412]/30 bg-[#fff1e6] p-4 text-sm text-[#9a3412]">
          This subscription is past its courtesy volume of {report.monthlyCap}{" "}
          reports this month. The report was still produced. TBC may follow up.
        </p>
      ) : null}

      <p className="mt-6 rounded-md border border-navy/10 bg-card p-4 text-sm leading-relaxed text-navy/80">
        {report.disclaimer}
      </p>

      <section className="mt-8 break-inside-avoid">
        <h3 className="font-heading text-2xl text-navy">Overall</h3>
        {overall && report.overallScore !== null ? (
          <p
            className="mt-3 inline-flex items-center gap-3 rounded-md px-4 py-3 text-sm"
            style={{ background: overall.surface, color: overall.swatch }}
          >
            <span className="font-medium">
              {overall.light}: {overall.label}
            </span>
            <span>Score {report.overallScore}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm">Not enough answers to score.</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-navy/70">
          {report.scoreExplanation}
        </p>
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">By area</h3>
        <div className="mt-4 grid gap-3">
          {report.areas.map((area) => {
            const meta = BAND_META[area.band];
            return (
              <article
                key={area.area}
                className="break-inside-avoid rounded-md border border-navy/10 p-4"
                style={{ background: meta.surface }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg text-navy">{area.area}</h4>
                  <p className="text-sm font-medium" style={{ color: meta.swatch }}>
                    {meta.light}: {meta.label} · {area.score}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-navy/80">{area.summary}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Key flags</h3>
        {report.redFlags.length === 0 ? (
          <p className="mt-3 text-sm text-navy/70">
            No critical item was answered in the risk direction. Unknown items
            can still sit inside an area score.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {report.redFlags.map((flag) => (
              <li key={flag.id} className="break-inside-avoid border-t border-navy/10 pt-3 text-sm">
                <p className="text-xs tracking-wide text-navy/50">
                  {flag.severity === "high" ? "High concern" : "Information gap"} ·{" "}
                  {flag.area} · {flag.id} · {flag.answer}
                </p>
                <p className="mt-1 text-navy">{flag.prompt}</p>
                {flag.note ? <p className="mt-1 text-navy/70">Note: {flag.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">
          Questions to ask before closing
        </h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-navy/85">
          {report.questionsToAsk.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Documents</h3>
        <p className="mt-2 text-sm text-navy/65">
          Uploaded files are deleted when this report is produced. The list is
          the record of what was received. File contents were not reviewed.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {report.documents.map((doc) => (
            <li key={doc.slot} className="border-t border-navy/10 pt-2">
              <span className="text-navy">{doc.title}</span>
              <span className="text-navy/60"> · {documentStatusLabel(doc.status)}</span>
              {doc.files.length > 0 ? (
                <span className="text-navy/70">
                  {" "}
                  ({doc.files.map((file) => file.fileName).join(", ")})
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {report.structuralNotes.map((note) => (
          <p key={note} className="mt-3 text-sm leading-relaxed text-navy/70">
            {note}
          </p>
        ))}
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Property facts used</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-navy/50">Year built</dt>
            <dd>{report.yearBuilt}</dd>
          </div>
          <div>
            <dt className="text-navy/50">3 or more stories</dt>
            <dd>{report.stories3}</dd>
          </div>
          <div>
            <dt className="text-navy/50">Within 3 miles of the coast</dt>
            <dd>{report.coastal}</dd>
          </div>
        </dl>
        {report.intakeNotes ? (
          <p className="mt-3 text-sm text-navy/75">Notes: {report.intakeNotes}</p>
        ) : null}
      </section>

      <section className="mt-8">
        <h3 className="font-heading text-2xl text-navy">Answer record</h3>
        <ol className="mt-4 space-y-3">
          {report.answers.map((answer) => (
            <li key={answer.id} className="break-inside-avoid border-t border-navy/10 pt-3 text-sm">
              <p className="text-xs text-navy/45">
                {answer.id} · {answer.area}
              </p>
              <p className="mt-1 text-navy">{answer.prompt}</p>
              <p className="mt-1 font-medium">{answer.answer}</p>
              {answer.note ? <p className="mt-1 text-navy/65">{answer.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 text-sm leading-relaxed text-navy/75">{report.disclaimer}</p>
      <p className="mt-3 text-sm text-navy/60">
        {emailed
          ? `A copy of this summary was sent to TBC Advisory. Save a PDF from the print dialog for your own file.`
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
