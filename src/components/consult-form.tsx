"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidEmail } from "@/lib/forms";
import { site } from "@/lib/site";
import { stripInquiryQuery, submitSiteForm } from "@/lib/submit-site-form";

type Fields = {
  name: string;
  email: string;
  phone: string;
  community: string;
  message: string;
};

const empty: Fields = {
  name: "",
  email: "",
  phone: "",
  community: "",
  message: "",
};

const SEND_ERROR =
  "We could not send your request. Please try again in a moment.";

export function ConsultForm({
  initialStatus = "idle",
}: {
  initialStatus?: "idle" | "success" | "error";
}) {
  const [fields, setFields] = useState<Fields>(empty);
  const [hpTrap, setHpTrap] = useState("");
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    initialStatus === "success"
      ? "success"
      : initialStatus === "error"
        ? "error"
        : "idle",
  );
  const [submitError, setSubmitError] = useState(
    initialStatus === "error" ? SEND_ERROR : "",
  );

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate() {
    const next: Partial<Fields> = {};
    if (!fields.name.trim()) next.name = "Please enter your name.";
    if (!fields.email.trim()) next.email = "Please enter your email.";
    else if (!isValidEmail(fields.email.trim()))
      next.email = "That email does not look complete.";
    if (!fields.community.trim())
      next.community = "Please name the community or association.";
    if (!fields.message.trim())
      next.message = "Please tell us what the board is facing.";
    return next;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    if (Object.keys(next).length) {
      setErrors(next);
      setStatus("idle");
      setSubmitError("");
      return;
    }

    setStatus("sending");
    setSubmitError("");
    try {
      await submitSiteForm("/api/consult", {
        ...fields,
        hp_trap: hpTrap,
      });
      stripInquiryQuery();
      setStatus("success");
      setFields(empty);
      setHpTrap("");
    } catch (error) {
      stripInquiryQuery();
      setStatus("error");
      setSubmitError(
        error instanceof Error && error.message ? error.message : SEND_ERROR,
      );
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-md border border-brass/40 bg-white/60 p-6"
      >
        <p className="font-heading text-xl text-navy">Thank you.</p>
        <p className="mt-3 text-sm leading-relaxed text-navy/75">
          Your consultation request is with the office. We will follow up from{" "}
          {site.email}.
        </p>
        <button
          type="button"
          className="mt-5 text-sm text-navy/70 underline-offset-4 hover:underline"
          onClick={() => {
            setStatus("idle");
            setFields(empty);
            setSubmitError("");
          }}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form
      action="/api/consult"
      method="post"
      onSubmit={onSubmit}
      className="relative space-y-5"
    >
      {status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {submitError || SEND_ERROR}
        </p>
      ) : null}
      <input
        type="text"
        name="hp_trap"
        tabIndex={-1}
        autoComplete="off"
        hidden
        value={hpTrap}
        onChange={(event) => setHpTrap(event.target.value)}
      />
      <Field
        id="name"
        label="Name"
        error={errors.name}
        value={fields.name}
        onChange={(value) => update("name", value)}
        autoComplete="name"
      />
      <Field
        id="email"
        label="Email"
        type="email"
        error={errors.email}
        value={fields.email}
        onChange={(value) => update("email", value)}
        autoComplete="email"
      />
      <Field
        id="phone"
        label="Phone"
        type="tel"
        optional
        value={fields.phone}
        onChange={(value) => update("phone", value)}
        autoComplete="tel"
      />
      <Field
        id="community"
        label="Community or association"
        error={errors.community}
        value={fields.community}
        onChange={(value) => update("community", value)}
      />
      <div className="space-y-2">
        <Label htmlFor="message">What is the board facing?</Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          value={fields.message}
          aria-invalid={Boolean(errors.message)}
          onChange={(event) => update("message", event.target.value)}
          required
          className="min-h-32 rounded-md bg-white px-3 py-2 text-base md:text-sm"
        />
        {errors.message ? (
          <p className="text-sm text-destructive">{errors.message}</p>
        ) : null}
      </div>
      <p className="text-sm text-navy/60">
        Submit on this page. We follow up from {site.email}. Nothing is stored
        on the site beyond sending that message.
      </p>
      <Button
        type="submit"
        disabled={status === "sending"}
        className="h-11 rounded-md bg-primary px-6 text-[0.95rem] text-primary-foreground hover:bg-primary/90"
      >
        {status === "sending" ? "Sending…" : "Request a free consultation"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  optional,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-navy/45">optional</span>
        ) : null}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={!optional}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md bg-white px-3 text-base md:text-sm"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
