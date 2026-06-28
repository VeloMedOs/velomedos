import { createFileRoute, redirect } from "@tanstack/react-router";

const ALIAS: Record<string, string> = {
  "": "/Privacy/Home",
  "home": "/Privacy/Home",
  "termsofservice": "/Privacy/TermsOfService",
  "terms": "/Privacy/TermsOfService",
  "hipaa": "/Privacy/HIPAA",
  "patientrights": "/Privacy/PatientRights",
  "patient-rights": "/Privacy/PatientRights",
};

/** Lowercase /privacy/* visitors are redirected to canonical /Privacy/* casing. */
export const Route = createFileRoute("/privacy/$")({
  beforeLoad: ({ params }) => {
    const key = (params._splat ?? "").toLowerCase().replace(/[/_-]/g, "").replace(/\?.*$/, "");
    const to = ALIAS[key] ?? "/Privacy/Home";
    throw redirect({ to, statusCode: 301 } as any);
  },
  component: () => null,
});