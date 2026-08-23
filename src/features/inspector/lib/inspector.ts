import type { ModuleGraph, ModuleNode } from "@/lib/types";

/** id → node lookup for chain formatting. */
export type ModuleIdMap = Map<string, ModuleNode>;

export interface LatestBadgeInfo {
  label: string;
  tone: "ok" | "accent";
}

/**
 * Latest-version badge text, given the shipped version and the cached npm
 * `latest`. Returns null when either side is unknown (UI shows "checking…"
 * or nothing in that case).
 */
export function latestBadge(
  version: string | undefined,
  latest: string | undefined,
): LatestBadgeInfo | null {
  if (version === undefined || latest === undefined) return null;
  if (version === latest) return { label: "up to date", tone: "ok" };
  return { label: `→ ${latest} available`, tone: "accent" };
}

/**
 * Human-readable module label for lineage chains: package modules collapse
 * to their owning package name, local modules keep their full path, and
 * unresolvable node_modules paths degrade to their tail after the last
 * `node_modules/` segment.
 */
export function displayModuleId(id: string, byId: ModuleIdMap): string {
  const node = byId.get(id);
  if (node?.pkg) return node.pkg;
  if (!id.includes("node_modules")) return id;
  const lastNm = id.lastIndexOf("node_modules/");
  const tail = lastNm === -1 ? id : id.slice(lastNm + "node_modules/".length);
  return tail || id;
}

/** Turn one lineage chain (module ids) into display labels. */
export function formatLineageChain(chain: string[], byId: ModuleIdMap): string[] {
  return chain.map((id) => displayModuleId(id, byId));
}

/** Importers / imports counts for a module in the graph. */
export function moduleDegrees(
  graph: ModuleGraph,
  id: string,
): { importedBy: number; imports: number } {
  let importedBy = 0;
  let imports = 0;
  for (const [from, to] of graph.edges) {
    if (to === id) importedBy++;
    if (from === id) imports++;
  }
  return { importedBy, imports };
}