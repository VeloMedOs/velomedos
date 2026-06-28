import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "HIPAA Notice of Privacy Practices — VeloMed OS";
const DESC  = "How VeloMed safeguards Protected Health Information as a Business Associate under the HIPAA Privacy, Security, and Breach Notification Rules.";

export const Route = createFileRoute("/Privacy/HIPAA")({
  validateSearch: (s: Record<string, unknown>) => ({ locale: (s.locale === "ar" ? "ar" : "en") as "en" | "ar" }),
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "https://velomedos.com/Privacy/HIPAA" },
    ],
    links: [
      { rel: "canonical", href: "https://velomedos.com/Privacy/HIPAA" },
      { rel: "alternate", hrefLang: "en", href: "https://velomedos.com/Privacy/HIPAA?locale=en" },
      { rel: "alternate", hrefLang: "ar", href: "https://velomedos.com/Privacy/HIPAA?locale=ar" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "hipaa", "en"],
    queryFn: () => getLegalDoc({ data: { slug: "hipaa", locale: "en" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { locale } = useSearch({ from: "/Privacy/HIPAA" });
  const { data } = useQuery({
    queryKey: ["legal", "hipaa", locale],
    queryFn: () => fn({ data: { slug: "hipaa", locale } }),
  });
  return <PrivacyShell doc={data ?? null} activeKey="hipaa" />;
}