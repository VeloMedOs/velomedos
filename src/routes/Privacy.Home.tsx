import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLegalDoc } from "@/lib/legal.functions";
import { PrivacyShell } from "@/components/legal/PrivacyShell";

const TITLE = "Privacy Policy — VeloMed OS";
const DESC  = "How VeloMed Infrastructure Group collects, uses, and protects personal and health information across the VeloMed OS platform. Aligned with KSA PDPL, GCC data laws, and HIPAA.";

export const Route = createFileRoute("/Privacy/Home")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:url", content: "/Privacy/Home" },
    ],
    links: [{ rel: "canonical", href: "/Privacy/Home" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData({
    queryKey: ["legal", "home"],
    queryFn: () => getLegalDoc({ data: { slug: "home" } }),
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getLegalDoc);
  const { data } = useQuery({ queryKey: ["legal", "home"], queryFn: () => fn({ data: { slug: "home" } }) });
  return <PrivacyShell doc={data ?? null} activeKey="home" />;
}