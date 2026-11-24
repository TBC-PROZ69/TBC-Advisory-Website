"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WizardButton({
  onPress,
  children,
  variant = "default",
  disabled = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  variant?: "default" | "outline";
  disabled?: boolean;
}) {
  const ignoreClickUntil = useRef(0);

  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled}
      className={cn(
        "h-11",
        variant === "default" && "bg-primary text-white hover:bg-primary/90",
      )}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
      }}
      onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (disabled || event.pointerType === "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) return;
        ignoreClickUntil.current = performance.now() + 400;
        onPress();
      }}
      onClick={() => {
        if (disabled) return;
        if (performance.now() < ignoreClickUntil.current) return;
        onPress();
      }}
    >
      {children}
    </Button>
  );
}
