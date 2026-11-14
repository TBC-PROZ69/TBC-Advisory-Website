"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { isSubmitTooFast, TOO_FAST_ERROR } from "@/lib/form-timing";
import {
  TURNSTILE_REJECTED_ERROR,
  turnstileSiteKey,
} from "@/lib/turnstile-public";

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const readyListeners = new Set<() => void>();

function notifyTurnstileReady() {
  readyListeners.forEach((listener) => listener());
}

// Off-screen, not type=hidden: bots that skip hidden inputs still fill this.
function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
      }}
    >
      <label htmlFor="hp_trap">Website</label>
      <input
        id="hp_trap"
        type="text"
        name="hp_trap"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ position: "absolute", left: "-9999px", top: "auto" }}
      />
    </div>
  );
}

function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = turnstileSiteKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    let widgetId = "";
    let cancelled = false;

    function render() {
      if (cancelled || widgetId || !containerRef.current || !window.turnstile) {
        return;
      }
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
        "timeout-callback": () => onTokenRef.current(""),
      });
    }

    readyListeners.add(render);
    render();

    return () => {
      cancelled = true;
      readyListeners.delete(render);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src={TURNSTILE_SCRIPT}
        strategy="afterInteractive"
        onLoad={notifyTurnstileReady}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  );
}

export function useInquiryProtection() {
  const [hpTrap, setHpTrap] = useState("");
  const [token, setToken] = useState("");
  const [epoch, setEpoch] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  function payload(
    form?: HTMLFormElement,
  ):
    | { ok: true; fields: Record<string, string> }
    | { ok: false; error: string } {
    const trapField = form?.elements.namedItem("hp_trap");
    const trap =
      trapField instanceof HTMLInputElement ? trapField.value : hpTrap;
    const fields = {
      hp_trap: trap,
      turnstile_token: token,
      form_started_at: startedAt.current ? String(startedAt.current) : "",
    };
    if (trap.trim()) return { ok: true, fields };
    if (isSubmitTooFast(startedAt.current || null)) {
      return { ok: false, error: TOO_FAST_ERROR };
    }
    if (turnstileSiteKey() && !token) {
      return { ok: false, error: TURNSTILE_REJECTED_ERROR };
    }
    return { ok: true, fields };
  }

  function onAccepted() {
    setHpTrap("");
    setToken("");
    setEpoch((current) => current + 1);
  }

  function onRejected() {
    setToken("");
    setEpoch((current) => current + 1);
  }

  const honeypot = <HoneypotField value={hpTrap} onChange={setHpTrap} />;
  const turnstile = <TurnstileField key={epoch} onToken={setToken} />;

  return { payload, onAccepted, onRejected, honeypot, turnstile };
}
