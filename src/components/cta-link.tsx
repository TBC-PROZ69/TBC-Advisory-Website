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
      "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "cream" &&
      "border-transparent bg-white text-primary hover:bg-white/90",
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
