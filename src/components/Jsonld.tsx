// Helper: stringify a JSON-LD payload for use inside route head.scripts entries.
export const jsonld = (data: unknown) => JSON.stringify(data);

import { SITE } from "@/lib/site-config";

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  name: SITE.brand,
  legalName: SITE.legal,
  description: SITE.description,
  url: "/",
  telephone: SITE.contact.phone,
  email: SITE.contact.email,
  address: { "@type": "PostalAddress", ...SITE.contact.address },
  areaServed: SITE.cities.map((c) => ({ "@type": "City", name: c.name, containedInPlace: c.country })),
  sameAs: Object.values(SITE.social),
  contactPoint: [{
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: SITE.contact.phone,
    email: SITE.contact.email,
    availableLanguage: ["en"],
  }],
});

export const breadcrumbLd = (items: Array<{ name: string; href: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((i, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: i.name,
    item: i.href,
  })),
});

export const faqLd = (faqs: ReadonlyArray<{ q: string; a: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const BASE = "https://velomedos.com";

export const webPageLd = (args: { path: string; name: string; description: string; type?: "WebPage" | "AboutPage" | "ContactPage" | "FAQPage" | "CollectionPage" }) => ({
  "@context": "https://schema.org",
  "@type": args.type ?? "WebPage",
  name: args.name,
  description: args.description,
  url: `${BASE}${args.path}`,
  isPartOf: { "@type": "WebSite", name: SITE.brand, url: BASE },
  publisher: { "@type": "Organization", name: SITE.legal, url: BASE },
  inLanguage: "en",
});

export const pageLdScripts = (args: { path: string; name: string; description: string; type?: "WebPage" | "AboutPage" | "ContactPage" | "FAQPage" | "CollectionPage" }) => [
  { type: "application/ld+json", children: jsonld(organizationLd()) },
  { type: "application/ld+json", children: jsonld(webPageLd(args)) },
];