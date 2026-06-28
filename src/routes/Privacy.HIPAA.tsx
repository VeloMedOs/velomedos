import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "HIPAA Notice of Privacy Practices — VeloMed OS";
const DESC  = "How VeloMed safeguards Protected Health Information as a Business Associate under the HIPAA Privacy, Security, and Breach Notification Rules.";

export const Route = createFileRoute("/Privacy/HIPAA")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "/Privacy/HIPAA" },
    ],
    links: [{ rel: "canonical", href: "/Privacy/HIPAA" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "hipaa"],
    queryFn: () => getLegalDoc({ data: { slug: "hipaa" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { data } = useQuery({ queryKey: ["legal", "hipaa"], queryFn: () => fn({ data: { slug: "hipaa" } }) });
  return <PrivacyShell doc={data ?? null} activeKey="hipaa" />;
}