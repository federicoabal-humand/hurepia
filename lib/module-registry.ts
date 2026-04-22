/**
 * lib/module-registry.ts
 * Maps HuReport module slugs to Notion page IDs and display metadata.
 * Used to fetch module documentation and enrich Gemini's context.
 */

export interface ModuleEntry {
  pageId: string;
  displayName: string;
  tribe: string;
}

export const MODULE_NOTION_MAP: Record<string, ModuleEntry> = {
  time_off: {
    pageId: "be9c4bff79754c87843c9c05fee135ed",
    displayName: "Time Off",
    tribe: "time_management",
  },
  work_schedules: {
    pageId: "33a6757f31308019a873e2ba691e91e6",
    displayName: "Time Planning",
    tribe: "time_management",
  },
  attendance: {
    pageId: "84c0001735a2424da5a1098f68995adc",
    displayName: "Time Tracking",
    tribe: "time_management",
  },
  people_experience: {
    pageId: "30608a0ec5da49308ffacbddd8b90de8",
    displayName: "People Experience",
    tribe: "data",
  },
  personal_documents: {
    pageId: "d64f44d27f494dd0a9101a0383790646",
    displayName: "My Documents",
    tribe: "data",
  },
  users: {
    pageId: "d1b82d04477d4177a8f576cae7fb21cc",
    displayName: "Users & User Profile",
    tribe: "people_foundation",
  },
  onboarding: {
    pageId: "9799460f69a943f68e74ec4ffee0cb72",
    displayName: "Onboarding",
    tribe: "talent",
  },
  learning: {
    pageId: "cf9c941d938c484e8beb245df40c6464",
    displayName: "Humand Learning",
    tribe: "talent",
  },
  knowledge: {
    pageId: "1036757f3130803f8c0cf37582b935c7",
    displayName: "Knowledge Libraries",
    tribe: "talent",
  },
  acknowledgements: {
    pageId: "c9e8f1d9a8e74a59ab0c4ed8234899cd",
    displayName: "Kudos",
    tribe: "talent",
  },
  org_chart: {
    pageId: "fdbfcbdb1ff0416c83ce1424cc0b60ab",
    displayName: "Org Chart",
    tribe: "talent",
  },
  groups: {
    pageId: "78d422bc30cd40f1a98e3b806014b3fb",
    displayName: "Groups",
    tribe: "comms",
  },
  chats: {
    pageId: "e61f4d48afc544cb9879cb3987f582ec",
    displayName: "Chats",
    tribe: "comms",
  },
  events: {
    pageId: "1376757f31308048a9bfdc3e77d1d251",
    displayName: "Events",
    tribe: "comms",
  },
  news: {
    pageId: "1e16757f313080edb8b0ef7c5f9c16e6",
    displayName: "News",
    tribe: "comms",
  },
  marketplace: {
    pageId: "6d4a6d18497e4934bd4a4096c2a70381",
    displayName: "Marketplace",
    tribe: "comms",
  },
  service_management: {
    pageId: "90214e9288ce4498bed2f087bd09519d",
    displayName: "Service Management",
    tribe: "operations",
  },
  workflows: {
    pageId: "1186757f3130802fa431d1ce96bd3add",
    displayName: "Workflows",
    tribe: "operations",
  },
};
