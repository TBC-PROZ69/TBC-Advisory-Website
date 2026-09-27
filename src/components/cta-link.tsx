import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "ghost" | "brass" | "cream";

export function CtaLink({
  href,
  children,
  variant = "default",
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    buttonVariants({
      variant: variant === "brass" || variant === "cream" ? "default" : variant,
      size: "lg",
    }),
    "h-11 rounded-md px-6 text-[0.95rem]",
    variant === "brass" &&
      "border-transparent bg-brass text-navy hover:bg-brass/90",
    variant === "cream" &&
      "border-transparent bg-cream text-navy hover:bg-cream/90",
    variant === "outline" && "border-current bg-transparent",
    className,
  );

  if (href.startsWith("mailto:") || href.startsWith("http")) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick}
        {...(href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} onClick={onClick}>
      {children}
    </Link>
  );
}
