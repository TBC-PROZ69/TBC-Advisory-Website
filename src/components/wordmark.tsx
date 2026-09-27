import { cn } from "@/lib/utils";

const lockupAlt =
  "TBC Advisory — Independent Partner to HOA & COA Boards";

export function Wordmark({
  className,
  variant = "lockup",
}: {
  className?: string;
  variant?: "lockup" | "mark";
}) {
  if (variant === "mark") {
    return (
      // The monogram is paths (no live text). PNG keeps the locked colors.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/tbc-advisory-logo-mark.png"
        alt="TBC Advisory"
        width={341}
        height={341}
        className={cn("h-10 w-auto", className)}
      />
    );
  }

  return (
    // Raster lockup so the Times wordmark does not reflow if the font is missing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/tbc-advisory-logo-lockup.png"
      alt={lockupAlt}
      width={2400}
      height={640}
      className={cn("h-14 w-auto", className)}
    />
  );
}
