import { canonKey, isMissingToken } from "./text";

export const UNCATEGORIZED = "Uncategorized";

// canonKey(raw) -> canonical task category. Merges casing, hyphenation, and
// abbreviations. Ambiguous merges are deliberate and documented in the README:
//  - "Deck Building" + "Slide Building" -> one (same work, different naming).
//  - "Docs"/"Documentation" kept separate from "Document Drafting"/"Drafting".
//  - "meetings" -> Internal Meeting; "Internal Communication" -> Internal Comms.
const CATEGORY_MAP: Record<string, string> = {
  bookkeeping: "Bookkeeping",
  "crm update": "CRM Updates",
  "crm updates": "CRM Updates",
  "cal mgmt": "Calendar Mgmt",
  "calendar mgmt": "Calendar Mgmt",
  "calendar management": "Calendar Mgmt",
  "client call": "Client Call",
  "client comms": "Client Communication",
  "client communication": "Client Communication",
  "data entry": "Data Entry",
  "deck building": "Deck/Slide Building",
  "slide building": "Deck/Slide Building",
  docs: "Documentation",
  documentation: "Documentation",
  "document drafting": "Document Drafting",
  drafting: "Document Drafting",
  "doc drafting": "Document Drafting",
  "email triage": "Email Triage",
  "gst filing prep": "GST Filing Prep",
  "gst prep": "GST Filing Prep",
  "internal comms": "Internal Comms",
  "internal communication": "Internal Comms",
  "internal meeting": "Internal Meeting",
  meetings: "Internal Meeting",
  "invoice proc": "Invoice Processing",
  "invoice processing": "Invoice Processing",
  "lead entry": "Lead Entry",
  notes: "Notes",
  "pipeline review": "Pipeline Review",
  reporting: "Reporting",
  recon: "Reconciliation",
  reconciliation: "Reconciliation",
  research: "Research",
  "status updates": "Status Updates",
  "ticket updates": "Ticket Updates",
  "vendor mgmt": "Vendor Mgmt",
  "vendor management": "Vendor Mgmt",
  "vendor portals": "Vendor Portals",
};

export function normalizeCategory(raw: string): string {
  if (isMissingToken(raw)) return UNCATEGORIZED;
  const key = canonKey(raw);
  if (key in CATEGORY_MAP) return CATEGORY_MAP[key];
  return raw.trim().replace(/\s+/g, " ");
}
