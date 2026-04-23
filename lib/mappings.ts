// ─── Jira constants ───────────────────────────────────────────────────────────
// Issue type ID 10060 = "Error" (untranslated: Bug) in HUREP project
export const JIRA = {
  PROJECT_KEY: "HUREP",
  ISSUE_TYPE_BUG_ID: "10060",
  FIELDS: {
    BUG_DESCRIPTION:         "customfield_10108", // textarea  (plain string)
    MINI_APP:                "customfield_10071", // multicheckboxes ([{id}])
    BUG_TYPE:                "customfield_10100", // multicheckboxes ([{id}])
    AFFECTED_USERS_COUNT:    "customfield_10113", // radiobutton ({id})
    BUG_BLOCKING:            "customfield_10112", // radiobutton ({id})
    AFFECTED_CLIENTS:        "customfield_10046", // labels (string[])
    AFFECTED_CLIENTS_SIZE:   "customfield_10109", // select ({id})
    BUG_REPRODUCED:          "customfield_10110", // radiobutton ({id})
    AFFECTED_CLIENTS_CHURN:  "customfield_10111", // radiobutton ({id})
    AFFECTED_CLIENTS_EXPANSION: "customfield_10114",
  },
  // Option IDs for BUG_BLOCKING (customfield_10112)
  BLOCKING_YES: "10243",
  BLOCKING_NO:  "10244",
  // Option IDs for AFFECTED_USERS_COUNT (customfield_10113)
  USERS_ONE:    "10246", // "1"
  USERS_MANY:   "10245", // ">1"
  // Default Bug Type: Functional (customfield_10100)
  BUG_TYPE_FUNCTIONAL: "10221",
  // Bug Reproduced: No by default
  REPRODUCED_NO: "10240",
} as const;

// ─── Module → Jira Mini App option ID ─────────────────────────────────────────
// Maps HuReport module keys to the exact option IDs in customfield_10071
export const MODULE_TO_JIRA_ID: Record<string, string> = {
  users:              "10115",
  segmentation:       "10225", // Roles/Perm
  work_schedules:     "10583", // Schedules
  attendance:         "10252", // Time Tracking
  news:               "10110",
  knowledge:          "10109", // Libraries
  forms:              "10107",
  surveys:            "10112",
  people_experience:  "10227", // People Exp
  learning:           "10275",
  service_management: "10223", // Service Mgmt
  onboarding:         "10111",
  files:              "10106",
  personal_documents: "10104", // Documents
  quick_access:       "10117", // General (no direct option)
  time_off:           "10122", // Time Off
  performance:        "10215", // Perf Review
  goals:              "10274",
  communication:      "10117", // General (no direct option)
  acknowledgements:   "10100",
  groups:             "10224",
  feed:               "10105",
  chats:              "10103",
  events:             "10278",
  org_chart:          "10121", // Org Chart
  profile:            "10119",
  marketplace:        "10120",
  integrations:       "10108",
  notifications:      "10281",
  widgets:            "10116",
  workflows:          "10279",
  general:            "10117",
};

// ─── Notion databases ─────────────────────────────────────────────────────────
export const NOTION_DB = {
  COMUNIDADES_CLIENTES: "2cc6757f-3130-8187-be30-e7091fad4eb1",
  CLIENTS_INPUTS:       "400416b1-ae3b-421f-9444-093dd40c7373",
  PRODUCT_HOME:         "c0f1e1a1-9e88-43d1-ac78-dbbd28a61b16",
} as const;

// ─── Status mapping ───────────────────────────────────────────────────────────
export type FriendlyStatus =
  | "reported"
  | "under_review"
  | "developing_fix"
  | "resolved";

/**
 * Maps Jira status to a user-facing friendly status.
 *
 * Strategy (in priority order):
 *   1. statusCategoryKey  — always reliable ("new" | "indeterminate" | "done")
 *   2. statusName substring — fallback for when category isn't passed
 *
 * Real HUREP statuses observed:
 *   "Tareas por hacer"  → new         → reported
 *   "En revisión"       → indeterminate → under_review
 *   "Finalizada"        → done        → resolved
 */
export function mapJiraStatusToFriendly(
  statusName: string,
  statusCategoryKey?: string
): FriendlyStatus {
  // ── 1. Category key is the most reliable signal ────────────────────────────
  if (statusCategoryKey === "done") return "resolved";
  if (statusCategoryKey === "indeterminate") {
    const s = statusName.toLowerCase();
    if (
      s.includes("review") || s.includes("revisión") || s.includes("revision") ||
      s.includes("análisis") || s.includes("analisis") || s.includes("analysis")
    ) return "under_review";
    return "developing_fix";
  }
  // statusCategoryKey === "new" falls through to default "reported"

  // ── 2. Fallback by name (backward compat / direct callers) ─────────────────
  const s = statusName.toLowerCase();

  if (
    s.includes("done") || s.includes("closed") || s.includes("resolved") ||
    s.includes("hecho") || s.includes("resuelto") || s.includes("cerrado") ||
    s.includes("completado") || s.includes("finalizada") || s.includes("finalizado") ||
    s.includes("listo")
  ) return "resolved";

  if (
    s.includes("progress") || s.includes("development") || s.includes("developing") ||
    s.includes("progreso") || s.includes("desarrollo") || s.includes("desarrollando") ||
    s.includes("en curso")
  ) return "developing_fix";

  if (
    s.includes("review") || s.includes("analysis") || s.includes("testing") ||
    s.includes("revisión") || s.includes("revision") || s.includes("análisis") ||
    s.includes("analisis") || s.includes("qa")
  ) return "under_review";

  return "reported";
}

// ─── 32 Humand modules ────────────────────────────────────────────────────────
export const MODULES = [
  "users",
  "segmentation",
  "work_schedules",
  "attendance",
  "news",
  "knowledge",
  "forms",
  "surveys",
  "people_experience",
  "learning",
  "service_management",
  "onboarding",
  "files",
  "personal_documents",
  "quick_access",
  "time_off",
  "performance",
  "goals",
  "communication",
  "acknowledgements",
  "groups",
  "feed",
  "chats",
  "events",
  "org_chart",
  "profile",
  "marketplace",
  "integrations",
  "notifications",
  "widgets",
  "workflows",
  "general",
] as const;

export type Module = (typeof MODULES)[number];

export const PLATFORMS = ["admin_web", "web_app", "mobile_app", "api"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Classification =
  | "bug_confirmed"
  | "configuration_error"
  | "cache_browser"
  | "expected_behavior"
  | "needs_more_info"
  | "feature_request"
  /** AI identified this as a known open issue already tracked */
  | "bug_known"
  /** AI identified this as an issue already resolved recently */
  | "bug_already_resolved";
