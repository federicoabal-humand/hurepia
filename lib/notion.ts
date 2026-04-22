/**
 * lib/notion.ts
 * Notion API helpers for HuReport AI.
 *
 * Env: NOTION_API_TOKEN
 */
import { NOTION_DB } from "./mappings";

const NOTION_VERSION = "2022-06-28";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// ─── Community search ─────────────────────────────────────────────────────────

export interface CommunityResult {
  id: string;
  name: string;
}

/**
 * Search COMUNIDADES_CLIENTES database by community name.
 * Returns up to 5 matches. Falls back to [] on error.
 *
 * Strategy 1: Notion global /v1/search (smart full-text, works regardless
 *   of which property stores the name).
 * Strategy 2: Full DB query with client-side filter (handles rollup values).
 */
export async function searchCommunities(
  query: string
): Promise<CommunityResult[]> {
  const token = process.env.NOTION_API_TOKEN;
  if (!token || query.length < 2) return [];

  const dbId = NOTION_DB.COMUNIDADES_CLIENTES.replace(/-/g, "");

  // ── Strategy 1: global search ──────────────────────────────────────────────
  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        query,
        filter: { property: "object", value: "page" },
        page_size: 10,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const inDb = (data.results ?? []).filter((page: Record<string, unknown>) => {
        const parent = page.parent as { type?: string; database_id?: string } | undefined;
        return (
          parent?.type === "database_id" &&
          (parent.database_id ?? "").replace(/-/g, "") === dbId
        );
      });

      if (inDb.length > 0) {
        return inDb.slice(0, 5).map((page: Record<string, unknown>) => ({
          id: page.id as string,
          name: extractCommunityName(
            (page.properties ?? {}) as Record<string, unknown>,
            page.id as string
          ),
        }));
      }
    }
  } catch { /* fall through */ }

  // ── Strategy 2: query all pages, filter client-side ────────────────────────
  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB.COMUNIDADES_CLIENTES}/query`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ page_size: 50 }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const q = query.toLowerCase();
      return (data.results ?? [])
        .map((page: Record<string, unknown>) => ({
          id: page.id as string,
          name: extractCommunityName(
            (page.properties ?? {}) as Record<string, unknown>,
            page.id as string
          ),
        }))
        .filter(
          (r: CommunityResult) =>
            r.name !== "?" && r.name.toLowerCase().includes(q)
        )
        .slice(0, 5);
    }
  } catch { /* fall through */ }

  return [];
}

/**
 * Extract the best human-readable name from a COMUNIDADES_CLIENTES page.
 * Handles title, rich_text, and rollup (show_original) property types.
 * Falls back to a short page-id label so the UI never shows "Unknown".
 */
function extractCommunityName(
  props: Record<string, unknown>,
  pageId: string
): string {
  for (const key of Object.keys(props)) {
    const prop = props[key] as Record<string, unknown> | undefined;
    if (!prop) continue;

    const type = prop["type"] as string | undefined;

    if (type === "title") {
      const arr = prop["title"] as Array<{ plain_text?: string }> | undefined;
      const text = arr?.[0]?.plain_text?.trim();
      if (text) return text;
    }

    if (type === "rich_text") {
      const arr = prop["rich_text"] as Array<{ plain_text?: string }> | undefined;
      const text = arr?.[0]?.plain_text?.trim();
      if (text) return text;
    }

    if (type === "rollup") {
      const rollup = prop["rollup"] as {
        type?: string;
        array?: Array<{
          type?: string;
          rich_text?: Array<{ plain_text?: string }>;
          title?: Array<{ plain_text?: string }>;
          formula?: { string?: string };
        }>;
        string?: string;
      } | undefined;

      // Scalar rollup (e.g. show_unique or coalesce)
      if (rollup?.string?.trim()) return rollup.string.trim();

      // Array rollup — first element
      const first = rollup?.array?.[0];
      if (first?.rich_text?.[0]?.plain_text?.trim())
        return first.rich_text[0].plain_text.trim();
      if (first?.title?.[0]?.plain_text?.trim())
        return first.title[0].plain_text.trim();
    }

    if (type === "formula") {
      const formula = prop["formula"] as { type?: string; string?: string } | undefined;
      if (formula?.string?.trim()) return formula.string.trim();
    }
  }

  // Absolute fallback: short ID (never show "Unknown" in the UI)
  return `?`;
}

// ─── Client inputs search ─────────────────────────────────────────────────────

export interface ClientInput {
  id: string;
  title: string;
}

/**
 * Search CLIENTS_INPUTS database for items matching any of the provided keywords.
 * Used for duplicate detection before creating a Jira ticket.
 * Title property in CLIENTS_INPUTS is "Input" (not "Name").
 */
export async function searchClientsInputs(
  keywords: string[]
): Promise<ClientInput[]> {
  const token = process.env.NOTION_API_TOKEN;
  if (!token || keywords.length === 0) return [];

  const terms = keywords.slice(0, 4).filter((k) => k.length >= 3);
  if (terms.length === 0) return [];

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB.CLIENTS_INPUTS}/query`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          filter: {
            or: terms.map((k) => ({
              property: "Input",   // ← actual title property (was "Name")
              title: { contains: k },
            })),
          },
          page_size: 5,
        }),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data.results ?? []).map((page: Record<string, unknown>) => {
      const props = (page.properties ?? {}) as Record<string, unknown>;
      return {
        id: page.id as string,
        title: extractCommunityName(props, page.id as string),
      };
    });
  } catch {
    return [];
  }
}
