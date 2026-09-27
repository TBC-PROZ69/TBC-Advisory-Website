import { professionalServiceJsonLd } from "@/lib/seo";

export function ProfessionalServiceJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(professionalServiceJsonLd()),
      }}
    />
  );
}
