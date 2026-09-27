import { Container } from "@/components/container";

export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-primary text-white">
      <Container className="py-16 sm:py-20">
        {eyebrow ? (
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-white/80 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading mt-3 max-w-3xl text-4xl leading-[1.15] tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        {children ? (
          <div className="mt-6 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {children}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
