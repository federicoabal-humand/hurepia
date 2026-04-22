// Jira field IDs — no tocar sin verificar en Jira
export const JIRA = {
  PROJECT_KEY: "HUREP",
  ISSUE_TYPE_BUG_ID: "10014",
  FIELDS: {
    BUG_DESCRIPTION: "customfield_10108",
    MINI_APP: "customfield_10071",
    BUG_TYPE: "customfield_10100",
    AFFECTED_USERS_COUNT: "customfield_10113",
    BUG_BLOCKING: "customfield_10112",
    AFFECTED_CLIENTS: "customfield_10046",
    AFFECTED_CLIENTS_SIZE: "customfield_10109",
    BUG_REPRODUCED: "customfield_10110",
    AFFECTED_CLIENTS_CHURN: "customfield_10111",
    AFFECTED_CLIENTS_EXPANSION: "customfield_10114",
  },
} as const;

// Notion databases
export const NOTION_DB = {
  COMUNIDADES_CLIENTES: "2cc6757f-3130-8187-be30-e7091fad4eb1",
  CLIENTS_INPUTS: "400416b1-ae3b-421f-9444-093dd40c7373",
  PRODUCT_HOME: "c0f1e1a1-9e88-43d1-ac78-dbbd28a61b16",
} as const;

// Mapeo de estado Jira → estado amigable user-facing
// NUNCA exponer el estado Jira crudo
export type FriendlyStatus =
  | "reported"
  | "under_review"
  | "developing_fix"
  | "resolved";

export function mapJiraStatusToFriendly(jiraStatus: string): FriendlyStatus {
  const s = jiraStatus.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) {
    return "resolved";
  }
  if (s.includes("progress") || s.includes("development") || s.includes("developing")) {
    return "developing_fix";
  }
  if (s.includes("review") || s.includes("analysis")) {
    return "under_review";
  }
  return "reported";
}

// 32 módulos de Humand (ES/EN)
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
  | "needs_more_info";
