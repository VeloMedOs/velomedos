import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/Privacy/")({
  beforeLoad: () => { throw redirect({ to: "/Privacy/Home" }); },
  component: () => null,
});