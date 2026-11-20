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

export function UploadStep({
  token,
  slots,
  consent,
  choices,
  files,
  onConsent,
  onChoice,
  onFileAdded,
  onFileRemoved,
  onBack,
  onContinue,
  busy,
}: {
  token: string;
  slots: DocumentSlot[];
  consent: boolean;
  choices: Record<string, "not-available" | "skipped" | "">;
  files: Record<string, StoredFile[]>;
  onConsent: (value: boolean) => void;
  onChoice: (slot: string, choice: "not-available" | "skipped" | "") => void;
  onFileAdded: (slot: string, file: StoredFile) => void;
  onFileRemoved: (slot: string, fileId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef("");

  const allFiles = Object.values(files).flat();

  async function send(slot: DocumentSlot, file: File) {
    setError("");
    if (!consent) {
      setError("Confirm the consent line before uploading.");
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
      const response = await fetch("/api/buyers/documents", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; file?: StoredFile & { slot: string } }
        | null;
      if (!response.ok || !data?.file) {
        throw new Error(data?.error || "The file could not be stored.");
      }
      if ("url" in data.file) {
        throw new Error("The file could not be stored.");
      }
      onFileAdded(slot.id, {
        id: data.file.id,
        fileName: data.file.fileName,
        byteSize: data.file.byteSize,
      });
      onChoice(slot.id, "");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The file could not be stored.",
      );
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
      const response = await fetch("/api/buyers/documents", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "The file could not be removed.");
      onFileRemoved(slotId, fileId);
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "The file could not be removed.",
      );
    } finally {
      setPending("");
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div>
        <h2 className="font-heading text-2xl text-navy">Documents</h2>
        <p className="mt-3 text-sm leading-relaxed text-navy/75">
          Attach what a buyer would usually read before closing. Each item is
          optional. Choose Upload, Not available, or Skip. Not available means
          you asked and the document does not exist or was refused. Skip means
          you are not attaching it. Files stay private, are not published, and
          are deleted when the report is produced. This screening records the
          file name only. It does not read the file for findings.
        </p>
        <p className="mt-3 text-sm text-navy/60">
          PDF, JPEG, PNG, WEBP, GIF, DOCX, or XLSX. 4 MB per file, 32 MB for
          the whole packet. ZIP files are not accepted, so send separate PDFs.
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

      <ol className="space-y-6">
        {slots.map((slot) => {
          const slotFiles = files[slot.id] ?? [];
          const choice = choices[slot.id] ?? "";
          return (
            <li key={slot.id} className="rounded-md border border-navy/10 bg-card p-4">
              <h3 className="font-heading text-lg text-navy">{slot.title}</h3>
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
                        onClick={() => void remove(slot.id, file.id)}
                        disabled={pending === slot.id}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-navy/70">
                  {choice === "not-available"
                    ? "Marked not available."
                    : choice === "skipped"
                      ? "Skipped."
                      : "No file yet."}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <WizardButton
                  disabled={!consent || pending === slot.id || slotFiles.length >= slot.maxFiles}
                  onPress={() => {
                    if (!consent) {
                      setError("Confirm the consent line before uploading.");
                      return;
                    }
                    slotRef.current = slot.id;
                    inputRef.current?.click();
                  }}
                >
                  {pending === slot.id ? "Working…" : "Upload"}
                </WizardButton>
                <WizardButton
                  variant="outline"
                  disabled={slotFiles.length > 0 || pending === slot.id}
                  onPress={() => onChoice(slot.id, "not-available")}
                >
                  Not available
                </WizardButton>
                <WizardButton
                  variant="outline"
                  disabled={slotFiles.length > 0 || pending === slot.id}
                  onPress={() => onChoice(slot.id, "skipped")}
                >
                  Skip
                </WizardButton>
              </div>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <WizardButton variant="outline" onPress={onBack} disabled={busy || Boolean(pending)}>
          Back
        </WizardButton>
        <WizardButton onPress={onContinue} disabled={busy || Boolean(pending)}>
          {busy ? "Preparing the report…" : "See my report"}
        </WizardButton>
      </div>
    </div>
  );
}
