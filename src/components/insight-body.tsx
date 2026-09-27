"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

const components: Components = {
  h2: ({ children }) => (
    <h2 className="font-heading mt-10 text-2xl tracking-tight text-navy first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-heading mt-8 text-xl tracking-tight text-navy">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-5 leading-relaxed first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-5 list-disc space-y-2 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-5 list-decimal space-y-3 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-navy">{children}</strong>
  ),
  a: ({ href, children }) => {
    const external = Boolean(href?.startsWith("http"));
    return (
      <a
        href={href}
        className="text-primary underline-offset-4 hover:underline"
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="mt-10 border-l-2 border-primary pl-4 text-sm leading-relaxed text-navy/70">
      {children}
    </blockquote>
  ),
};

export function InsightBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-base text-navy/80">
      <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
    </div>
  );
}
