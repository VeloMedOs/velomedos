import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/solutions/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/services/$slug", params: { slug: params.slug } });
  },
});