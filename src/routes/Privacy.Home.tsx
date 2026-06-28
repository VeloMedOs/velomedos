import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "Privacy Policy — VeloMed OS";
const DESC  = "How VeloMed Infrastructure Group collects, uses, and protects personal and health information across the VeloMed OS platform. Aligned with KSA PDPL, GCC data laws, and HIPAA.";

export const Route = createFileRoute("/Privacy/Home")({
  validateSearch: (s: Record<string, unknown>) => ({ locale: (s.locale === "ar" ? "ar" : "en") as "en" | "ar" }),
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "/Privacy/Home" },
    ],
    links: [
      { rel: "canonical", href: "/Privacy/Home" },
      { rel: "alternate", hrefLang: "en", href: "/Privacy/Home?locale=en" },
      { rel: "alternate", hrefLang: "ar", href: "/Privacy/Home?locale=ar" },
    ],
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