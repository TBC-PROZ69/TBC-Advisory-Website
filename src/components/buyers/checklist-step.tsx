"use client";

import { useRef, useState } from "react";

import { WizardButton } from "@/components/buyers/wizard-button";
import type { StoredFile } from "@/components/buyers/storage";
import { MAX_FILE_BYTES } from "@/lib/buyers/constants";
import { UPLOAD_CONSENT } from "@/lib/buyers/copy";
import {
  inspectUpload,
  totalsWithinLimits,
  type DocumentSlot,
} from "@/lib/buyers/documents";

export function ChecklistStep({
  token,
  slots,
  consent,
  missing,
  na,
  notes,
  files,
  onConsent,
  onMissing,
  onNa,
  onNote,
  onFileAdded,
  onFileRemoved,
  onBack,
  onSubmit,
  busy,
}: {
  token: string;
  slots: DocumentSlot[];
  consent: boolean;
  missing: Record<string, boolean>;
  na: Record<string, boolean>;
  notes: Record<string, string>;
  files: Record<string, StoredFile[]>;
  onConsent: (value: boolean) => void;
  onMissing: (slot: string, value: boolean) => void;
  onNa: (slot: string, value: boolean) => void;
  onNote: (slot: string, note: string) => void;
  onFileAdded: (slot: string, file: StoredFile) => void;
  onFileRemoved: (slot: string, fileId: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef("");
  const allFiles = Object.values(files).flat();
  const addressed = slots.filter(
    (slot) => (files[slot.id] ?? []).length > 0 || missing[slot.id] || na[slot.id],
  ).length;
  const ready = addressed === slots.length && !pending;

  async function send(slot: DocumentSlot, file: File) {
    setError("");
    if (!consent) {
      setError("Confirm the consent line before attaching a file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Each file must be 4 MB or smaller.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectUpload(file.name, file.type, bytes);
    if (!inspected.ok) {
      setError(inspected.error);
      return;
    }
    const limit = totalsWithinLimits(allFiles, file.size);
    if (limit) {
      setError(limit);
      return;
    }
    const form = new FormData();
    form.set("t", token);
    form.set("slot", slot.id);
    form.set("action", "upload");
    form.set("consent", "yes");
    form.set("file", file);
    setPending(slot.id);
    try {
      const response = await fetch("/api/buyers/documents", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; file?: StoredFile & { slot: string } }
        | null;
      if (!response.ok || !data?.file || "url" in data.file) {
        throw new Error(data?.error || "The file could not be stored.");
      }
      onFileAdded(slot.id, {
        id: data.file.id,
        fileName: data.file.fileName,
        byteSize: data.file.byteSize,
      });
      onMissing(slot.id, false);
      onNa(slot.id, false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The file could not be stored.");
    } finally {
      setPending("");
    }
  }

  async function remove(slotId: string, fileId: string) {
    setError("");
    setPending(slotId);
    try {
      const form = new FormData();
      form.set("t", token);
      form.set("slot", slotId);
      form.set("action", "remove");
      form.set("fileId", fileId);
      const response = await fetch("/api/buyers/documents", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "The file could not be removed.");
      onFileRemoved(slotId, fileId);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The file could not be removed.");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <div className="flex items-center justify-between text-xs tracking-wide text-navy/60 uppercase">
          <span>Checklist</span>
          <span>
            {addressed} of {slots.length} addressed
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy/10">
          <div
            className="h-full bg-primary"
            style={{ width: `${slots.length ? Math.round((addressed / slots.length) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-navy/70">
          Each row needs one choice. I don&apos;t have this is a finding.
          Doesn&apos;t apply, where it is offered, is not. You can attach more
          than one file on a row.
        </p>
      </div>

      <label className="flex gap-3 rounded-md border border-primary/30 bg-card p-4 text-sm leading-relaxed text-navy/80">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={consent}
          onChange={(event) => onConsent(event.target.checked)}
        />
        <span>{UPLOAD_CONSENT}</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.xlsx,application/pdf,image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const slot = slots.find((item) => item.id === slotRef.current);
          event.target.value = "";
          if (file && slot) void send(slot, file);
        }}
      />

      <ol className="space-y-4">
        {slots.map((slot, index) => {
          const slotFiles = files[slot.id] ?? [];
          const markedMissing = Boolean(missing[slot.id]) && slotFiles.length === 0;
          const markedNa = Boolean(na[slot.id]) && slotFiles.length === 0 && !markedMissing;
          const done = slotFiles.length > 0 || markedMissing || markedNa;
          return (
            <li key={slot.id} className="rounded-md border border-navy/10 bg-card p-4">
              <p className="text-xs text-navy/45">
                {index + 1} of {slots.length}
                {done ? " · Addressed" : ""}
              </p>
              <h3 className="font-heading mt-1 text-lg text-navy">{slot.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-navy/65">{slot.detail}</p>
              {slotFiles.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {slotFiles.map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {file.fileName}{" "}
                        <span className="text-navy/50">
                          ({Math.max(1, Math.round(file.byteSize / 1024))} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                        disabled={pending === slot.id}
                        onClick={() => void remove(slot.id, file.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <WizardButton
                  disabled={!consent || pending === slot.id || slotFiles.length >= slot.maxFiles}
                  onPress={() => {
                    if (!consent) {
                      setError("Confirm the consent line before attaching a file.");
                      return;
                    }
                    slotRef.current = slot.id;
                    inputRef.current?.click();
                  }}
                >
                  {pending === slot.id ? "Working…" : "Attach file"}
                </WizardButton>
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={markedMissing}
                    disabled={slotFiles.length > 0 || pending === slot.id}
                    onChange={(event) => {
                      onMissing(slot.id, event.target.checked);
                      if (event.target.checked) onNa(slot.id, false);
                    }}
                  />
                  I don&apos;t have this
                </label>
                {slot.allowsNa ? (
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={markedNa}
                      disabled={slotFiles.length > 0 || pending === slot.id}
                      onChange={(event) => {
                        onNa(slot.id, event.target.checked);
                        if (event.target.checked) onMissing(slot.id, false);
                      }}
                    />
                    Doesn&apos;t apply
                  </label>
                ) : null}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-navy/60">Add a note</summary>
                <label className="mt-2 block text-xs text-navy/55">
                  Optional
                  <textarea
                    className="mt-1 min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-navy"
                    maxLength={500}
                    value={notes[slot.id] ?? ""}
                    onChange={(event) => onNote(slot.id, event.target.value)}
                  />
                </label>
              </details>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!ready ? (
        <p className="text-sm text-navy/60">
          Choose Attach file, I don&apos;t have this, or Doesn&apos;t apply where it
          is offered, on every row.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <WizardButton variant="outline" onPress={onBack} disabled={busy || Boolean(pending)}>
          Back
        </WizardButton>
        <WizardButton onPress={onSubmit} disabled={!ready || busy}>
          {busy ? "Preparing the report…" : "See my report"}
        </WizardButton>
      </div>
    </div>
  );
}
