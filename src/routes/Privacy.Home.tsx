import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";
import { pageLdScripts } from "@/components/Jsonld";

const TITLE = "Privacy Policy — VeloMed OS";
const DESC  = "How VeloMed OS collects, uses and protects personal and health information across the platform — aligned with KSA PDPL, GCC laws and HIPAA.";

export const Route = createFileRoute("/Privacy/Home")({
  validateSearch: (s: Record<string, unknown>) => ({ locale: (s.locale === "ar" ? "ar" : "en") as "en" | "ar" }),
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "https://velomedos.com/Privacy/Home" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "robots", content: "index,follow" },
    ],
    links: [
      { rel: "canonical", href: "https://velomedos.com/Privacy/Home" },
      { rel: "alternate", hrefLang: "en", href: "https://velomedos.com/Privacy/Home?locale=en" },
      { rel: "alternate", hrefLang: "ar", href: "https://velomedos.com/Privacy/Home?locale=ar" },
    ],
    scripts: pageLdScripts({ path: "/Privacy/Home", name: TITLE, description: DESC }),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "privacy-home", "en"],
    queryFn: () => getLegalDoc({ data: { slug: "privacy-home", locale: "en" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { locale } = useSearch({ from: "/Privacy/Home" });
  const { data } = useQuery({
    queryKey: ["legal", "privacy-home", locale],
    queryFn: () => fn({ data: { slug: "privacy-home", locale } }),
  });
  return <PrivacyShell doc={data ?? null} activeKey="privacy-home" />;
}