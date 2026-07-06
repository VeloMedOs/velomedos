import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listServicesTool from "./tools/list-services";
import listLegalDocumentsTool from "./tools/list-legal-documents";
import getLegalDocumentTool from "./tools/get-legal-document";

export default defineMcp({
  name: "velomedos-mcp",
  title: "VeloMed OS",
  version: "0.1.0",
  instructions:
    "Tools for VeloMed OS. Use `list_services` to browse the product catalog, `list_legal_documents` / `get_legal_document` for privacy/terms/HIPAA/patient-rights content, and `echo` to verify connectivity.",
  tools: [echoTool, listServicesTool, listLegalDocumentsTool, getLegalDocumentTool],
});