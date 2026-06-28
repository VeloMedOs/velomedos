import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";
import { pageLdScripts } from "@/components/Jsonld";

const TITLE = "Patient Rights & Responsibilities — VeloMed OS";
const DESC  = "The rights you can expect when receiving care through the VeloMed OS platform, aligned with the Saudi MoH Patient Bill of Rights and the CHI Beneficiary Charter.";

export const Route = createFileRoute("/Privacy/PatientRights")({
  validateSearch: (s: Record<string, unknown>) => ({ locale: (s.locale === "ar" ? "ar" : "en") as "en" | "ar" }),
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "https://velomedos.com/Privacy/PatientRights" },
    ],
    links: [
      { rel: "canonical", href: "https://velomedos.com/Privacy/PatientRights" },
      { rel: "alternate", hrefLang: "en", href: "https://velomedos.com/Privacy/PatientRights?locale=en" },
      { rel: "alternate", hrefLang: "ar", href: "https://velomedos.com/Privacy/PatientRights?locale=ar" },
    ],
    scripts: pageLdScripts({ path: "/Privacy/PatientRights", name: TITLE, description: DESC }),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "patient-rights", "en"],
    queryFn: () => getLegalDoc({ data: { slug: "patient-rights", locale: "en" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { locale } = useSearch({ from: "/Privacy/PatientRights" });
  const { data } = useQuery({
    queryKey: ["legal", "patient-rights", locale],
    queryFn: () => fn({ data: { slug: "patient-rights", locale } }),
  });
  return <PrivacyShell doc={data ?? null} activeKey="patient-rights" />;
}