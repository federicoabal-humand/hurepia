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
 * Tries property name variants in order until one returns results.
 * Stops on the first attempt that returns ≥1 results.
 */
export async function searchCommunities(
  query: string
): Promise<CommunityResult[]> {
  const token = process.env.NOTION_API_TOKEN;
  if (!token || query.length < 2) return [];

  const propertyAttempts = [
    { property: "Nombre", type: "rich_text", filter: { contains: query } },
    { property: "Name",   type: "title",     filter: { contains: query } },
    { property: "Empresa",type: "title",     filter: { contains: query } },
    { property: "Nombre", type: "title",     filter: { contains: query } },
  ];

  for (const attempt of propertyAttempts) {
    try {
      const res = await fetch(
        `https://api.notion.com/v1/databases/${NOTION_DB.COMUNIDADES_CLIENTES}/query`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            filter: {
              property: attempt.property,
              [attempt.type]: attempt.filter,
            },
            page_size: 5,
          }),
        }
      );

      if (!res.ok) continue; // wrong property type/name → try next

      const data = await res.json();
      const results: CommunityResult[] = (data.results ?? []).map(
        (page: Record<string, unknown>) => {
          const props = (page.properties ?? {}) as Record<string, unknown>;
          return { id: page.id as string, name: extractText(props) };
        }
      );

      // Only stop if we actually got results — if 0, try next property variant
      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }

  return [];
}

/** Extract the first available text from any Notion property */
function extractText(props: Record<string, unknown>): string {
  for (const key of Object.keys(props)) {
    const prop = props[key] as Record<string, unknown> | undefined;
    if (!prop) continue;
    const titleArr = prop["title"] as Array<{ plain_text?: string; text?: { content: string } }> | undefined;
    if (titleArr?.[0]) {
      const t = titleArr[0];
      if (t.plain_text) return t.plain_text;
      if (t.text?.content) return t.text.content;
    }
    const rtArr = prop["rich_text"] as Array<{ plain_text?: string; text?: { content: string } }> | undefined;
    if (rtArr?.[0]) {
      const t = rtArr[0];
      if (t.plain_text) return t.plain_text;
      if (t.text?.content) return t.text.content;
    }
  }
  return "Unknown";
}

// ─── Client inputs search ─────────────────────────────────────────────────────

export interface ClientInput {
  id: string;
  title: string;
}

/**
 * Search CLIENTS_INPUTS database for items matching any of the provided keywords.
 * Used for duplicate detection before creating a Jira ticket.
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
              property: "Name",
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
      return { id: page.id as string, title: extractText(props) };
    });
  } catch {
    return [];
  }
}
