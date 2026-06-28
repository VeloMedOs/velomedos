import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "Terms of Service — VeloMed OS";
const DESC  = "The legally binding contract governing your use of the VeloMed OS platform and the services offered by VeloMed Infrastructure Group.";

export const Route = createFileRoute("/Privacy/TermsOfService")({
  validateSearch: (s: Record<string, unknown>) => ({ locale: (s.locale === "ar" ? "ar" : "en") as "en" | "ar" }),
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "https://velomedos.com/Privacy/TermsOfService" },
    ],
    links: [
      { rel: "canonical", href: "https://velomedos.com/Privacy/TermsOfService" },
      { rel: "alternate", hrefLang: "en", href: "https://velomedos.com/Privacy/TermsOfService?locale=en" },
      { rel: "alternate", hrefLang: "ar", href: "https://velomedos.com/Privacy/TermsOfService?locale=ar" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "terms-of-service", "en"],
    queryFn: () => getLegalDoc({ data: { slug: "terms-of-service", locale: "en" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { locale } = useSearch({ from: "/Privacy/TermsOfService" });
  const { data } = useQuery({
    queryKey: ["legal", "terms-of-service", locale],
    queryFn: () => fn({ data: { slug: "terms-of-service", locale } }),
  });
  return <PrivacyShell doc={data ?? null} activeKey="terms-of-service" />;
}