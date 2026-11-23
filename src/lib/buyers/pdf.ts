import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { BuyerAssessment } from "@/lib/buyers/assessment";
import { DOMAINS, RATINGS } from "@/lib/buyers/assessment";
import { BuyersError } from "@/lib/buyers/errors";
import type { BuyerReport } from "@/lib/buyers/report";
import type { BuyerBand } from "@/lib/buyers/types";
import { site } from "@/lib/site";

const BLUE = rgb(0x12 / 255, 0x6b / 255, 0xae / 255);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const MUTED_GREEN = rgb(0.36, 0.55, 0.42);
const MUTED_AMBER = rgb(0.7, 0.52, 0.24);
const MUTED_RED = rgb(0.62, 0.33, 0.33);
const ROW_BAND = rgb(0.96, 0.97, 0.98);
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const FOOTER_Y = 32;

const PDF_DISCLAIMER =
  "This Buyers Health Check is checklists and guidance. It is informational only. It quotes text and figures taken from the documents provided. It is not legal advice, financial advice, an engineering opinion, or an inspection. A scanned page may be unreadable. Confirm anything that matters with the association before closing.";

function winAnsi(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\t\n\r\x20-\x7E]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of winAnsi(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        const trial = chunk + char;
        if (font.widthOfTextAtSize(trial, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = trial;
        }
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

const BANDS = new Set<BuyerBand>(["Low", "Moderate", "Elevated", "Critical"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseReportForPdf(value: unknown): BuyerReport {
  const record = asRecord(value);
  if (!record) throw new BuyersError("The report is missing.", 400);
  const associationName = clip(record.associationName, 200);
  const createdAt = clip(record.createdAt, 40);
  if (!associationName || Number.isNaN(Date.parse(createdAt))) {
    throw new BuyersError("The report is missing.", 400);
  }
  const band = clip(record.overallBand, 20);
  const findings = Array.isArray(record.findings) ? record.findings.slice(0, 20) : [];
  const requests = Array.isArray(record.requests) ? record.requests.slice(0, 20) : [];
  const notApplicable = Array.isArray(record.notApplicable)
    ? record.notApplicable.slice(0, 20)
    : [];
  return {
    id: clip(record.id, 80) || "report",
    createdAt,
    disclaimer: PDF_DISCLAIMER,
    associationName,
    unitAddress: clip(record.unitAddress, 200),
    state: clip(record.state, 8),
    stateName: clip(record.stateName, 40) || "Florida",
    personName: clip(record.personName, 120),
    personEmail: clip(record.personEmail, 200),
    completer: clip(record.completer, 40) || "Buyer",
    agentLine: clip(record.agentLine, 200) || null,
    typedAgentLine: clip(record.typedAgentLine, 300) || null,
    stories3: clip(record.stories3, 40),
    linkKind: record.linkKind === "agent" ? "agent" : "one-time",
    overCap: false,
    monthlyCap: null,
    overallBand: BANDS.has(band as BuyerBand) ? (band as BuyerBand) : "Moderate",
    summary: clip(record.summary, 1000),
    addressed: 0,
    total: 0,
    findings: findings.map((item, index) => {
      const row = asRecord(item);
      return {
        id: clip(row?.id, 40) || `finding-${index}`,
        title: clip(row?.title, 160) || "Document",
        status: "not-provided" as const,
        signal: "standard" as const,
        text: clip(row?.text, 1000),
        note: clip(row?.note, 500),
        files: [],
      };
    }),
    requests: requests.map((item) => {
      const row = asRecord(item);
      return { title: clip(row?.title, 160) || "Document", ask: clip(row?.ask, 1000) };
    }),
    notApplicable: notApplicable.map((item, index) => {
      const row = asRecord(item);
      return { id: clip(row?.id, 40) || `na-${index}`, title: clip(row?.title, 160) || "Document" };
    }),
    attachedNotes: [],
    documents: [],
    assessment: clipAssessment(record.assessment),
  };
}

function clipAssessment(value: unknown): BuyerAssessment | null {
  const record = asRecord(value);
  if (!record) return null;
  const rating = clip(record.overallRating, 20);
  if (!RATINGS.includes(rating as (typeof RATINGS)[number])) return null;
  const rows = Array.isArray(record.scorecard) ? record.scorecard : [];
  const numbers = Array.isArray(record.keyNumbers) ? record.keyNumbers : [];
  const findings = Array.isArray(record.findings) ? record.findings : [];
  const strings = (key: string) =>
    (Array.isArray(record[key]) ? record[key] : [])
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.slice(0, 500))
      .slice(0, 20);
  return {
    overallRating: rating as BuyerAssessment["overallRating"],
    bottomLine: clip(record.bottomLine, 1200),
    unavailable: clip(record.unavailable, 300) || null,
    scorecard: rows.slice(0, 8).flatMap((item) => {
      const row = asRecord(item);
      const domain = clip(row?.domain, 80);
      const rowRating = clip(row?.rating, 20);
      if (!DOMAINS.includes(domain as (typeof DOMAINS)[number])) return [];
      if (!RATINGS.includes(rowRating as (typeof RATINGS)[number])) return [];
      return [
        {
          domain: domain as BuyerAssessment["scorecard"][number]["domain"],
          rating: rowRating as BuyerAssessment["overallRating"],
          note: clip(row?.note, 500),
        },
      ];
    }),
    keyNumbers: numbers.slice(0, 20).map((item) => {
      const row = asRecord(item);
      return {
        label: clip(row?.label, 120),
        value: clip(row?.value, 80),
        source: clip(row?.source, 160),
        page: clip(row?.page, 40),
      };
    }),
    findings: findings.slice(0, 20).flatMap((item) => {
      const row = asRecord(item);
      const domain = clip(row?.domain, 80);
      if (!DOMAINS.includes(domain as (typeof DOMAINS)[number])) return [];
      return [
        {
          domain: domain as BuyerAssessment["findings"][number]["domain"],
          whatItSays: clip(row?.whatItSays, 800),
          citation: clip(row?.citation, 200),
          whyItMatters: clip(row?.whyItMatters, 500),
          askBeforeClosing: clip(row?.askBeforeClosing, 400),
        },
      ];
    }),
    redFlags: strings("redFlags"),
    questions: strings("questions"),
    dataGaps: strings("dataGaps"),
  };
}

export function buyersPdfFilename(association: string, createdAt: string) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(createdAt));
  const slug =
    winAnsi(association)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "Association";
  return `TBC-Buyers-Health-Check_${slug}_${date}.pdf`;
}

function preparedOn(createdAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "long",
  }).format(new Date(createdAt));
}

async function logoPng() {
  return readFile(path.join(process.cwd(), "public/brand/tbc-advisory-logo-lockup.png"));
}

export async function renderBuyerPdf(report: BuyerReport) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  try {
    logo = await doc.embedPng(await logoPng());
  } catch {
    logo = null;
  }

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - 36;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - 36;
    drawHeader();
  }

  function ensure(height: number) {
    if (y - height < 64) newPage();
  }

  function drawHeader() {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: BLUE });
    if (logo) {
      const height = 28;
      const width = (logo.width / logo.height) * height;
      page.drawImage(logo, { x: MARGIN, y: PAGE_HEIGHT - 48, width, height });
    } else {
      page.drawText("TBC Advisory", {
        x: MARGIN,
        y: PAGE_HEIGHT - 40,
        size: 14,
        font: bold,
        color: BLUE,
      });
    }
    const right = "Prepared by TBC Advisory";
    const date = preparedOn(report.createdAt);
    page.drawText(right, {
      x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(right, 9),
      y: PAGE_HEIGHT - 34,
      size: 9,
      font: bold,
      color: BLUE,
    });
    page.drawText(date, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(date, 9),
      y: PAGE_HEIGHT - 48,
      size: 9,
      font,
      color: BLACK,
    });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 60, width: PAGE_WIDTH - MARGIN * 2, height: 1.5, color: BLUE });
    y = PAGE_HEIGHT - 84;
  }

  function heading(text: string) {
    ensure(28);
    y -= 8;
    page.drawText(winAnsi(text), { x: MARGIN, y, size: 13, font: bold, color: BLUE });
    y -= 18;
  }

  function paragraph(text: string, size = 10) {
    const lines = wrap(text, font, size, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      ensure(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font, color: BLACK });
      y -= size + 4;
    }
  }

  function bullet(title: string, body: string) {
    const lines = wrap(`${title}. ${body}`.trim(), font, 10, PAGE_WIDTH - MARGIN * 2 - 12);
    for (const [index, line] of lines.entries()) {
      ensure(14);
      page.drawText(index === 0 ? `- ${line}` : `  ${line}`, {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: BLACK,
      });
      y -= 14;
    }
    y -= 4;
  }

  function ratingColor(rating: string) {
    if (rating === "Low") return MUTED_GREEN;
    if (rating === "Moderate" || rating === "Elevated") return MUTED_AMBER;
    return MUTED_RED;
  }

  function drawTable(headers: string[], rows: string[][], widths: number[], chipColumn = -1) {
    const tableWidth = widths.reduce((sum, item) => sum + item, 0);
    const size = 8;
    const lineHeight = 11;
    function rowHeight(cells: string[], header: boolean) {
      let lines = 1;
      cells.forEach((cell, index) => {
        if (!header && index === chipColumn) return;
        const used = header ? bold : font;
        lines = Math.max(lines, wrap(cell || " ", used, size, Math.max(12, widths[index] - 8)).length);
      });
      return lines * lineHeight + 10;
    }
    function paint(cells: string[], header: boolean, zebra: boolean) {
      const height = rowHeight(cells, header);
      ensure(height + 2);
      const bottom = y - height + 10;
      page.drawRectangle({
        x: MARGIN,
        y: bottom,
        width: tableWidth,
        height,
        color: header ? BLUE : zebra ? ROW_BAND : WHITE,
        borderColor: BLUE,
        borderWidth: 0.4,
      });
      let x = MARGIN;
      cells.forEach((cell, index) => {
        if (header) {
          wrap(cell, bold, size, widths[index] - 8).forEach((line, lineIndex) => {
            page.drawText(line, {
              x: x + 4,
              y: y - lineIndex * lineHeight,
              size,
              font: bold,
              color: WHITE,
            });
          });
        } else if (index === chipColumn) {
          const label = winAnsi(cell || "");
          const chipWidth = Math.min(widths[index] - 8, bold.widthOfTextAtSize(label, 8) + 12);
          page.drawRectangle({
            x: x + 4,
            y: bottom + 5,
            width: Math.max(chipWidth, 42),
            height: 14,
            color: ratingColor(cell),
          });
          page.drawText(label, {
            x: x + 8,
            y: bottom + 8,
            size: 8,
            font: bold,
            color: WHITE,
          });
        } else {
          wrap(cell || "", font, size, widths[index] - 8).forEach((line, lineIndex) => {
            page.drawText(line, {
              x: x + 4,
              y: y - lineIndex * lineHeight,
              size,
              font,
              color: BLACK,
            });
          });
        }
        x += widths[index];
      });
      y = bottom - 1;
    }
    paint(headers, true, false);
    rows.forEach((row, index) => paint(row, false, index % 2 === 1));
    y -= 8;
  }

  drawHeader();
  page.drawText("Buyers Health Check", { x: MARGIN, y, size: 18, font: bold, color: BLUE });
  y -= 24;
  paragraph(report.associationName, 12);
  if (report.unitAddress) paragraph(`Unit: ${report.unitAddress}`);
  paragraph(`State: ${report.stateName}`);
  paragraph(`${report.completer}: ${report.personName}`);
  if (report.agentLine) paragraph(`Subscription agent: ${report.agentLine}`);
  if (report.typedAgentLine) paragraph(`Agent named on the form: ${report.typedAgentLine}`);
  paragraph(`Date: ${preparedOn(report.createdAt)}`);

  const assessment = report.assessment;
  heading("Summary rating");
  if (assessment) {
    paragraph(`${assessment.overallRating}. ${assessment.bottomLine || report.summary}`);
    if (assessment.unavailable) paragraph(assessment.unavailable);
    heading("Scorecard");
    drawTable(
      ["Domain", "Rating", "Note"],
      assessment.scorecard.map((row) => [row.domain, row.rating, row.note]),
      [190, 78, 248],
      1,
    );
    heading("Key numbers");
    if (assessment.keyNumbers.length === 0) paragraph("No figure was quoted from a document.");
    else {
      drawTable(
        ["Metric", "Value", "Source"],
        assessment.keyNumbers.map((row) => [row.label, row.value, `${row.source}, ${row.page}`]),
        [170, 110, 236],
      );
    }
    heading("Findings by domain");
    if (assessment.findings.length === 0) paragraph("No quoted finding was returned.");
    for (const domain of DOMAINS) {
      const items = assessment.findings.filter((row) => row.domain === domain);
      if (items.length === 0) continue;
      heading(domain);
      for (const row of items) {
        paragraph(row.whatItSays);
        paragraph(`Citation: ${row.citation}`);
        paragraph(`Why it matters: ${row.whyItMatters}`);
        paragraph(`Ask before closing: ${row.askBeforeClosing}`);
      }
    }
    heading("Red flags");
    if (assessment.redFlags.length === 0) paragraph("None listed.");
    for (const item of assessment.redFlags) paragraph(item);
    heading("Questions to ask");
    for (const item of assessment.questions) paragraph(item);
    heading("Data gaps");
    if (assessment.dataGaps.length === 0) paragraph("None.");
    for (const item of assessment.dataGaps) paragraph(item);
  } else {
    paragraph(`${report.overallBand}. ${report.summary}`);
  }

  heading("Risk findings");
  if (report.findings.length === 0) {
    paragraph("Nothing was marked I don't have this.");
  } else {
    for (const finding of report.findings) {
      bullet(finding.title, finding.note ? `${finding.text} Note: ${finding.note}` : finding.text);
    }
  }

  heading("Documents to request before closing");
  if (report.requests.length === 0) {
    paragraph("Every checklist item was attached or marked Doesn't apply.");
  } else {
    for (const item of report.requests) bullet(item.title, item.ask);
  }

  heading("Doesn't apply");
  paragraph("These items are neutral. They are not risk findings and they are not on the request list.");
  if (report.notApplicable.length === 0) {
    paragraph("None.");
  } else {
    for (const item of report.notApplicable) bullet(item.title, "Marked Doesn't apply.");
  }

  heading("Disclaimer");
  paragraph(PDF_DISCLAIMER);

  pages.forEach((item, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    item.drawText(site.email, { x: MARGIN, y: FOOTER_Y, size: 9, font, color: BLACK });
    item.drawText(label, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 9),
      y: FOOTER_Y,
      size: 9,
      font,
      color: BLACK,
    });
  });

  return doc.save();
}
