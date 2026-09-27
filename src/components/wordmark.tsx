import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        inverted ? "text-cream" : "text-navy",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center border text-[0.68rem] font-semibold tracking-[0.14em]",
          inverted ? "border-brass text-brass" : "border-navy text-navy",
        )}
      >
        TBC
      </span>
      <span className="text-[0.78rem] font-medium tracking-[0.22em] uppercase">
        Advisory
      </span>
    </span>
  );
}
