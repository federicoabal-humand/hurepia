/**
 * lib/notion.ts
 * Notion API helpers for HuReport AI.
 *
 * Env: NOTION_API_TOKEN
 */
import { NOTION_DB } from "./mappings";
import { MODULE_NOTION_MAP } from "./module-registry";

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

// ─── CX Owner resolution ──────────────────────────────────────────────────────

export interface CommunityCxInfo {
  cxOwnerName?: string;
  found: boolean;
}

// In-memory cache: pageId → { info, cachedAt }
const cxCache: Record<string, { info: CommunityCxInfo; cachedAt: number }> = {};
const CX_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch the CX Owner name for a community from the COMUNIDADES_CLIENTES DB.
 *
 * Strategy 1: Read the "CX Owner" rollup directly from the page properties.
 *   - This works if the Notion integration has sufficient scopes.
 *
 * Strategy 2 (fallback): Follow the "Humand Clients" relation chain.
 *   a) Get relation IDs from COMUNIDADES_CLIENTES page
 *   b) Fetch the related page
 *   c) Read "CX Owner" (people property) from that page
 *   d) If only a user_id, call /v1/users/{id}
 *
 * Results cached for 30 minutes per pageId.
 * Returns { found: false } on all failures — never throws.
 */
export async function getCxOwnerForCommunity(
  pageId: string
): Promise<CommunityCxInfo> {
  const token = process.env.NOTION_API_TOKEN;
  if (!token || !pageId) return { found: false };

  // Check cache
  const cached = cxCache[pageId];
  if (cached && Date.now() - cached.cachedAt < CX_CACHE_TTL) {
    return cached.info;
  }

  const save = (info: CommunityCxInfo): CommunityCxInfo => {
    cxCache[pageId] = { info, cachedAt: Date.now() };
    return info;
  };

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: headers(),
    });
    if (!res.ok) return save({ found: false });

    const page = await res.json();
    const props = (page.properties ?? {}) as Record<string, unknown>;

    // ── Strategy 1: direct property on this page ──────────────────────────────
    for (const key of ["CX Owner", "cx_owner", "CX", "Owner"]) {
      const prop = props[key] as Record<string, unknown> | undefined;
      if (!prop) continue;
      const type = prop["type"] as string | undefined;

      if (type === "rollup") {
        const rollup = prop["rollup"] as {
          type?: string;
          array?: Array<{
            type?: string;
            people?: Array<{ name?: string }>;
            rich_text?: Array<{ plain_text?: string }>;
            title?: Array<{ plain_text?: string }>;
          }>;
          string?: string;
        } | undefined;

        if (rollup?.string?.trim())
          return save({ found: true, cxOwnerName: rollup.string.trim() });

        const first = rollup?.array?.[0];
        if (first?.people?.[0]?.name)
          return save({ found: true, cxOwnerName: first.people[0].name });
        if (first?.rich_text?.[0]?.plain_text?.trim())
          return save({ found: true, cxOwnerName: first.rich_text[0].plain_text.trim() });
        if (first?.title?.[0]?.plain_text?.trim())
          return save({ found: true, cxOwnerName: first.title[0].plain_text.trim() });
      }

      if (type === "people") {
        const people = prop["people"] as Array<{ name?: string; id?: string }> | undefined;
        if (people?.[0]?.name)
          return save({ found: true, cxOwnerName: people[0].name });
        // Only user_id — resolve via /v1/users
        if (people?.[0]?.id) {
          const name = await fetchUserName(people[0].id, token);
          if (name) return save({ found: true, cxOwnerName: name });
        }
      }

      if (type === "rich_text") {
        const arr = prop["rich_text"] as Array<{ plain_text?: string }> | undefined;
        if (arr?.[0]?.plain_text?.trim())
          return save({ found: true, cxOwnerName: arr[0].plain_text.trim() });
      }
    }

    // ── Strategy 2: follow "Humand Clients" relation ──────────────────────────
    const relationProp = props["Humand Clients"] as Record<string, unknown> | undefined;
    if (relationProp?.type === "relation") {
      const relations = relationProp["relation"] as Array<{ id?: string }> | undefined;
      const relatedId = relations?.[0]?.id;
      if (relatedId) {
        const relRes = await fetch(`https://api.notion.com/v1/pages/${relatedId}`, {
          headers: headers(),
        });
        if (relRes.ok) {
          const relPage = await relRes.json();
          const relProps = (relPage.properties ?? {}) as Record<string, unknown>;
          for (const key of ["CX Owner", "cx_owner", "CX", "Owner"]) {
            const prop = relProps[key] as Record<string, unknown> | undefined;
            if (!prop) continue;
            const type = prop["type"] as string | undefined;
            if (type === "people") {
              const people = prop["people"] as Array<{ name?: string; id?: string }> | undefined;
              if (people?.[0]?.name)
                return save({ found: true, cxOwnerName: people[0].name });
              if (people?.[0]?.id) {
                const name = await fetchUserName(people[0].id, token);
                if (name) return save({ found: true, cxOwnerName: name });
              }
            }
            if (type === "rich_text") {
              const arr = prop["rich_text"] as Array<{ plain_text?: string }> | undefined;
              if (arr?.[0]?.plain_text?.trim())
                return save({ found: true, cxOwnerName: arr[0].plain_text.trim() });
            }
          }
        }
      }
    }

    return save({ found: false });
  } catch {
    return save({ found: false });
  }
}

/** Resolve a Notion user ID to a display name via /v1/users/{id}. */
async function fetchUserName(userId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.notion.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return (user.name as string | undefined)?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── Internal community resolution ───────────────────────────────────────────

export interface ResolveResult {
  matched: boolean;
  pageId?: string;
  canonicalName?: string;
  cxOwnerName?: string | null;
}

// In-memory cache keyed by normalised nameRaw
const resolveCache: Record<string, { result: ResolveResult; cachedAt: number }> = {};
const RESOLVE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fuzzy-match a raw community name against COMUNIDADES_CLIENTES.
 * - Normalise: lowercase, trim, strip accents
 * - Score with Levenshtein (normalised). Threshold ≥ 0.7 to consider a match.
 * - On match: resolve CX Owner via existing getCxOwnerForCommunity().
 * - On no match: return { matched: false }.
 * - Result cached 30 min per nameRaw.
 * - NEVER surfaces match/no-match info to the frontend.
 */
export async function resolveCommunityInternal(
  nameRaw: string
): Promise<ResolveResult> {
  const token = process.env.NOTION_API_TOKEN;
  if (!token || !nameRaw.trim()) return { matched: false };

  const normalised = normalise(nameRaw);
  const cached = resolveCache[normalised];
  if (cached && Date.now() - cached.cachedAt < RESOLVE_CACHE_TTL) {
    return cached.result;
  }

  const save = (r: ResolveResult): ResolveResult => {
    resolveCache[normalised] = { result: r, cachedAt: Date.now() };
    return r;
  };

  try {
    const results = await searchCommunities(nameRaw);
    if (results.length === 0) return save({ matched: false });

    // Find best-scoring candidate
    let best: CommunityResult | null = null;
    let bestScore = 0;
    for (const r of results) {
      const score = similarity(normalised, normalise(r.name));
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }

    if (!best || bestScore < 0.7) return save({ matched: false });

    // Resolve CX Owner using the matched page ID
    const cx = await getCxOwnerForCommunity(best.id).catch(() => ({ found: false as const }));

    return save({
      matched: true,
      pageId: best.id,
      canonicalName: best.name,
      cxOwnerName: cx.found ? (cx.cxOwnerName ?? null) : null,
    });
  } catch {
    return save({ matched: false });
  }
}

/** Strip accents, lowercase, trim. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Levenshtein-based similarity ∈ [0, 1]. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

// ─── Module docs ──────────────────────────────────────────────────────────────

export interface ModuleDocsResult {
  found: boolean;
  displayName?: string;
  content?: string;
  notionUrl?: string;
}

/**
 * Fetch documentation blocks for a Humand module from Notion.
 * - If module not in MODULE_NOTION_MAP → { found: false }
 * - Fetches child blocks depth-1, extracts plain text from paragraphs,
 *   headings, bullets, callouts, toggles. Max 8000 chars.
 * - Timeout: 8s total.
 */
export async function getModuleDocs(
  moduleSlug: string
): Promise<ModuleDocsResult> {
  const token = process.env.NOTION_API_TOKEN;
  const entry = MODULE_NOTION_MAP[moduleSlug];
  if (!token || !entry) return { found: false };

  const { pageId, displayName } = entry;
  const notionUrl = `https://www.notion.so/${pageId.replace(/-/g, "")}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`,
      { headers: headers(), signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return { found: false };

    const data = await res.json();
    const blocks = data.results ?? [];
    const text = extractBlocksText(blocks, 8000);

    return {
      found: true,
      displayName,
      content: text || undefined,
      notionUrl,
    };
  } catch {
    return { found: false };
  }
}

/**
 * Extract plain text from Notion blocks (depth-1).
 * Handles: paragraph, heading_1/2/3, bulleted_list_item,
 *           numbered_list_item, callout, toggle, quote.
 */
function extractBlocksText(
  blocks: Array<Record<string, unknown>>,
  maxChars: number
): string {
  const parts: string[] = [];
  let total = 0;

  for (const block of blocks) {
    if (total >= maxChars) break;
    const type = block["type"] as string;
    const content = block[type] as Record<string, unknown> | undefined;
    if (!content) continue;

    const richText = content["rich_text"] as Array<{ plain_text?: string }> | undefined;
    if (!richText?.length) continue;

    const text = richText.map((t) => t.plain_text ?? "").join("").trim();
    if (!text) continue;

    parts.push(text);
    total += text.length;
  }

  return parts.join("\n").slice(0, maxChars);
}
