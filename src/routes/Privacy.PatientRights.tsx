import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "Patient Rights & Responsibilities — VeloMed OS";
const DESC  = "The rights you can expect when receiving care through the VeloMed OS platform, aligned with the Saudi MoH Patient Bill of Rights and the CHI Beneficiary Charter.";

export const Route = createFileRoute("/Privacy/PatientRights")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "/Privacy/PatientRights" },
    ],
    links: [{ rel: "canonical", href: "/Privacy/PatientRights" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "patient-rights"],
    queryFn: () => getLegalDoc({ data: { slug: "patient-rights" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { data } = useQuery({ queryKey: ["legal", "patient-rights"], queryFn: () => fn({ data: { slug: "patient-rights" } }) });
  return <PrivacyShell doc={data ?? null} activeKey="patient-rights" />;
}