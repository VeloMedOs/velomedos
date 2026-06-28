import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "Terms of Service — VeloMed OS";
const DESC  = "The legally binding contract governing your use of the VeloMed OS platform and the services offered by VeloMed Infrastructure Group.";

export const Route = createFileRoute("/Privacy/TermsOfService")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "/Privacy/TermsOfService" },
    ],
    links: [{ rel: "canonical", href: "/Privacy/TermsOfService" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "terms"],
    queryFn: () => getLegalDoc({ data: { slug: "terms" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { data } = useQuery({ queryKey: ["legal", "terms"], queryFn: () => fn({ data: { slug: "terms" } }) });
  return <PrivacyShell doc={data ?? null} activeKey="terms" />;
}