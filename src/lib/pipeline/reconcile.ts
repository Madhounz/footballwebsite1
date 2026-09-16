import type { Conflict, ProviderMatch, ProviderRecord, Resolution } from "./types";

/** Fields of a match we compare across providers. Order = priority in reports. */
export const MATCH_FIELDS = ["kickoff", "status", "score", "halfTimeScore", "round"] as const;
export type MatchField = (typeof MATCH_FIELDS)[number];

/**
 * Fields that state what happened on the pitch. These are decided by evidence
 * only: consensus, then majority, then the primary source. A language model is
 * never asked to settle one, because a plausible-sounding answer is worse than
 * an admitted disagreement once people trust the site.
 */
export const FACTUAL_FIELDS: ReadonlySet<string> = new Set(["status", "score", "halfTimeScore"]);

const stable = (v: unknown): string => JSON.stringify(v, Object.keys((v as object) ?? {}).sort());

/**
 * Decides a single value for one field from several providers' values.
 *  - all agree            -> consensus, confidence 1
 *  - strict majority      -> majority, confidence = share of agreeing weight
 *  - otherwise            -> highest-weight provider, low confidence, flagged
 */
export function decide(
  values: Record<string, unknown>,
  weights: Record<string, number>,
): Resolution {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined && v !== null);
  // Every provider says "nothing here" (no score for a future match): that is agreement.
  if (entries.length === 0) {
    return Object.keys(values).length > 0
      ? { value: null, resolvedBy: "consensus", confidence: 1 }
      : { value: undefined, resolvedBy: "unresolved", confidence: 0 };
  }
  if (entries.length === 1)
    return { value: entries[0][1], resolvedBy: "consensus", confidence: 0.6 };

  const groups = new Map<string, { value: unknown; providers: string[]; weight: number }>();
  let totalWeight = 0;
  for (const [provider, value] of entries) {
    const key = stable(value);
    const w = weights[provider] ?? 0.5;
    totalWeight += w;
    const g = groups.get(key) ?? { value, providers: [], weight: 0 };
    g.providers.push(provider);
    g.weight += w;
    groups.set(key, g);
  }
  if (groups.size === 1) return { value: entries[0][1], resolvedBy: "consensus", confidence: 1 };

  const ranked = [...groups.values()].sort(
    (a, b) => b.providers.length - a.providers.length || b.weight - a.weight,
  );
  const [top, second] = ranked;
  if (top.providers.length > second.providers.length) {
    return {
      value: top.value,
      resolvedBy: "majority",
      confidence: Math.round((top.weight / totalWeight) * 100) / 100,
    };
  }
  // tie on count: prefer weight but keep confidence low so the AI step reviews it
  return {
    value: top.value,
    resolvedBy: "weight",
    confidence: Math.min(0.5, top.weight / totalWeight),
  };
}

export interface ReconciledMatch {
  id: string;
  value: ProviderMatch;
  confidence: number;
  conflicts: Conflict[];
  /**
   * Factual fields where the sources disagreed outright on a finished match.
   * The primary source's value is kept and the match is flagged for review
   * rather than quietly picking a winner.
   */
  disputedFields: string[];
  /**
   * Only detail was reconciled — events and line-ups for a match already
   * stored. Its own row keeps the kickoff, scoreline and status it has.
   */
  detailOnly?: boolean;
}

/**
 * Groups provider records by our canonical match key (competition + kickoff day
 * + home + away) and reconciles field by field.
 */
export function reconcileMatches(
  records: ProviderRecord<ProviderMatch>[],
  weights: Record<string, number>,
  aiThreshold = 0.75,
): { matches: ReconciledMatch[]; needsReview: Conflict[] } {
  const byKey = new Map<string, ProviderRecord<ProviderMatch>[]>();
  for (const r of records) {
    const key = matchKey(r.value);
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const matches: ReconciledMatch[] = [];
  const needsReview: Conflict[] = [];
  for (const [key, list] of byKey) {
    // Detail is a union across providers, whether or not anyone described the
    // match in full this run: events de-duplicated by (minute, team, type,
    // player), line-ups from the first provider that has them.
    const seen = new Set<string>();
    const events = list
      .flatMap((r) => r.value.events ?? [])
      .filter((e) => {
        const k = `${e.minute}|${e.teamId}|${e.type}|${e.playerId ?? ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.minute - b.minute || (a.addedTime ?? 0) - (b.addedTime ?? 0));
    const lineups = list.find((r) => r.value.lineups)?.value.lineups;
    const eventsFinal = list.some((r) => r.value.eventsFinal);

    // Partial records only contribute detail. A match nobody describes in full
    // is either one we do not know at all — dropped — or an older one being
    // filled in, whose scoreline was settled by the run that could still see it
    // and must not be overwritten from a record that carries no score.
    const full = list.filter((r) => !r.value.partial);
    if (full.length === 0) {
      if (events.length === 0 && !lineups && !eventsFinal) continue;
      const value: ProviderMatch = { ...list[0].value, id: key, events, lineups, eventsFinal };
      delete value.partial;
      matches.push({
        id: key,
        value,
        confidence: 1,
        conflicts: [],
        disputedFields: [],
        detailOnly: true,
      });
      continue;
    }
    const base = {
      ...full.sort((a, b) => (weights[b.provider] ?? 0) - (weights[a.provider] ?? 0))[0].value,
    };
    const conflicts: Conflict[] = [];
    const contested: string[] = [];
    let confidence = 1;
    for (const field of MATCH_FIELDS) {
      const values: Record<string, unknown> = {};
      for (const r of full) values[r.provider] = r.value[field];
      const res = decide(values, weights);
      (base as Record<string, unknown>)[field] = res.value;
      if (res.resolvedBy !== "consensus") {
        confidence = Math.min(confidence, res.confidence);
        const conflict: Conflict = {
          entityType: "match",
          entityId: key,
          field,
          values,
          context: {
            kickoff: base.kickoff,
            homeTeamId: base.homeTeamId,
            awayTeamId: base.awayTeamId,
            competitionId: base.competitionId,
            status: base.status,
            chosen: res,
          },
        };
        conflicts.push(conflict);
        if (FACTUAL_FIELDS.has(field)) {
          // A straight disagreement with no majority: the primary source's value
          // stands and the match is quarantined. Never sent to the validator.
          if (res.resolvedBy === "weight") contested.push(field);
        } else if (res.confidence < aiThreshold) {
          needsReview.push(conflict);
        }
      }
    }
    // live minute: any provider that reports one
    const minute = list.find((r) => r.value.minute != null)?.value.minute ?? base.minute ?? null;
    const value: ProviderMatch = { ...base, id: key, events, lineups, minute, eventsFinal };
    delete value.partial;
    // Before full time the sources are simply at different points in the match,
    // which is lag rather than disagreement; only a settled result is flagged.
    const disputedFields = base.status === "finished" ? contested : [];
    matches.push({ id: key, value, confidence, conflicts, disputedFields });
  }
  return { matches, needsReview };
}

/** Canonical match id: competition, kickoff day, home, away. Stable across providers. */
export function matchKey(
  m: Pick<ProviderMatch, "competitionId" | "kickoff" | "homeTeamId" | "awayTeamId">,
): string {
  return `${m.competitionId}:${m.kickoff.slice(0, 10)}:${m.homeTeamId}:${m.awayTeamId}`;
}
