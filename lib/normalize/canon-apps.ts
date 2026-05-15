import { canonKey, isMissingToken } from "./text";

export const UNKNOWN_APP = "Unknown";

// canonKey(raw) -> canonical app name. Covers every spelling in the dataset
// (casing, whitespace padding, "MS"/"Microsoft"/"Google" prefixes, abbrevs).
const APP_MAP: Record<string, string> = {
  outlook: "Outlook",
  "ms outlook": "Outlook",
  "microsoft outlook": "Outlook",
  gmail: "Gmail",
  excel: "Excel",
  "ms excel": "Excel",
  "microsoft excel": "Excel",
  slack: "Slack",
  sap: "SAP",
  salesforce: "Salesforce",
  sfdc: "Salesforce",
  "sales force": "Salesforce",
  zoho: "Zoho",
  "zoho crm": "Zoho",
  chrome: "Chrome",
  "google chrome": "Chrome",
  jira: "Jira",
  notion: "Notion",
  powerpoint: "PowerPoint",
  "ms powerpoint": "PowerPoint",
  "microsoft powerpoint": "PowerPoint",
  ppt: "PowerPoint",
  word: "Word",
  "ms word": "Word",
  "microsoft word": "Word",
  tally: "Tally",
  "tally erp": "Tally",
  whatsapp: "WhatsApp",
  "whatsapp web": "WhatsApp",
  zoom: "Zoom",
};

export function normalizeApp(raw: string): string {
  if (isMissingToken(raw)) return UNKNOWN_APP;
  const key = canonKey(raw);
  if (key in APP_MAP) return APP_MAP[key];
  // Unknown spelling not seen in the dataset: keep a cleaned label rather
  // than silently merging it into "Unknown".
  return raw.trim().replace(/\s+/g, " ");
}
