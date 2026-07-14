import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listServicesTool from "./tools/list-services";
import listLegalDocumentsTool from "./tools/list-legal-documents";
import getLegalDocumentTool from "./tools/get-legal-document";

// OAuth issuer must be the direct Supabase host (see app-mcp-server-authoring).
// Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "velomedos-mcp",
  title: "VeloMed OS",
  version: "0.1.0",
  instructions:
    "Tools for VeloMed OS. Use `list_services` to browse the product catalog, `list_legal_documents` / `get_legal_document` for privacy/terms/HIPAA/patient-rights content, and `echo` to verify connectivity.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool, listServicesTool, listLegalDocumentsTool, getLegalDocumentTool],
});