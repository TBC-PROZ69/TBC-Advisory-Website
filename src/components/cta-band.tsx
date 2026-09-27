import { Container } from "@/components/container";
import { CtaLink } from "@/components/cta-link";
import { site } from "@/lib/site";

export function CtaBand({
  title = "Request a free consultation",
  body = "Tell us what the board is facing. We will follow up at the address below—no portal, no cookie wall, no sales script.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="bg-primary text-white">
      <Container className="flex flex-col items-start gap-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
        <div className="max-w-xl">
          <h2 className="font-heading text-3xl tracking-tight text-balance">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
            {body}
          </p>
          <a
            href={`mailto:${site.email}`}
            className="mt-3 inline-block text-sm text-white underline-offset-4 hover:underline"
          >
            {site.email}
          </a>
        </div>
        <CtaLink href="/contact" variant="cream">
          Open the consult form
        </CtaLink>
      </Container>
    </section>
  );
}
