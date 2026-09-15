import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { FACTUAL_FIELDS } from "./reconcile";
import type { Conflict, Resolution } from "./types";

/**
 * Claude settles what deterministic reconciliation cannot: providers that
 * disagree with no majority, and club or player names that match nothing in the
 * alias table. Every answer carries a confidence and reasoning that is stored
 * next to the record; anything under `minConfidence` stays flagged for a human.
 *
 * The model is never asked to invent data: it only picks among provider values
 * or declines.
 */

const MODEL = process.env.NINETY_AI_MODEL ?? "claude-opus-5";

const ConflictDecision = z.object({
  decisions: z.array(
    z.object({
      index: z.number().int().describe("Index of the conflict in the input list"),
      chosen_provider: z
        .string()
        .nullable()
        .describe("Provider whose value should be trusted, or null to leave unresolved"),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().describe("One or two sentences a data editor can audit"),
    }),
  ),
});

const EntityMatch = z.object({
  matches: z.array(
    z.object({
      provider_name: z.string(),
      canonical_id: z
        .string()
        .nullable()
        .describe("Our id when the name clearly refers to one of the known entities, else null"),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
  ),
});

const SYSTEM = `You are the data editor for a football (soccer) results website covering the Premier League, La Liga, Bundesliga, Serie A, UEFA Champions League and UEFA Europa League.
You receive records where licensed data providers disagree. Choose the value best supported by the evidence and by your knowledge of how football data works (kick-off times shift by broadcaster, provisional scores get corrected, own goals and penalties get re-credited, postponed matches keep their original round).
You are never asked to decide what happened on the pitch: scores, half-time scores and match status are settled from the sources themselves and quarantined when they disagree. Your remit is the surrounding detail — kick-off times, rounds, venues — and identity questions.
Rules:
- Only choose among the provided values. Never invent a value.
- Prefer the provider whose record was updated most recently for live or just-finished matches.
- For team or player identity, two names refer to the same entity only when the club, city or nickname clearly matches. "Inter" and "Internazionale" are the same; "Inter Miami" is not.
- If the evidence is genuinely insufficient, return null with a low confidence rather than guessing.
- Confidence is your honest probability that the choice is correct.`;

export interface AIValidatorOptions {
  client?: Anthropic;
  minConfidence?: number;
  model?: string;
}

export class AIValidator {
  private client: Anthropic;
  readonly minConfidence: number;
  readonly model: string;

  constructor(opts: AIValidatorOptions = {}) {
    this.client = opts.client ?? new Anthropic();
    this.minConfidence = opts.minConfidence ?? 0.8;
    this.model = opts.model ?? MODEL;
  }

  static available(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  /**
   * Resolves a batch of field conflicts. Returns one Resolution per conflict,
   * in the same order.
   *
   * Factual fields are refused outright, whatever the caller passes: what a
   * match ended is settled by evidence, not by a model. The pipeline already
   * filters them out; this is the second lock on the same door.
   */
  async resolveConflicts(
    conflicts: Conflict[],
    recency: Record<string, string | undefined> = {},
  ): Promise<Resolution[]> {
    if (conflicts.length === 0) return [];
    const refused = conflicts.filter((c) => FACTUAL_FIELDS.has(c.field));
    if (refused.length > 0) {
      throw new Error(
        `the validator may not decide factual fields (${[...new Set(refused.map((c) => c.field))].join(", ")})`,
      );
    }
    const payload = conflicts.map((c, index) => ({
      index,
      entity: c.entityType,
      id: c.entityId,
      field: c.field,
      values: c.values,
      provider_updated_at: Object.fromEntries(
        Object.keys(c.values).map((p) => [p, recency[p] ?? null]),
      ),
      context: c.context,
    }));

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Decide each of the following ${conflicts.length} conflicts.\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
      output_config: { format: zodOutputFormat(ConflictDecision) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return conflicts.map(() => ({
        value: undefined,
        resolvedBy: "unresolved",
        confidence: 0,
        reasoning: "model declined",
      }));
    }
    const byIndex = new Map(response.parsed_output.decisions.map((d) => [d.index, d]));
    return conflicts.map((c, i) => {
      const d = byIndex.get(i);
      if (
        !d ||
        !d.chosen_provider ||
        !(d.chosen_provider in c.values) ||
        d.confidence < this.minConfidence
      ) {
        return {
          value: undefined,
          resolvedBy: "unresolved",
          confidence: d?.confidence ?? 0,
          reasoning: d?.reasoning ?? "no decision",
        };
      }
      return {
        value: c.values[d.chosen_provider],
        resolvedBy: "ai",
        confidence: d.confidence,
        reasoning: d.reasoning,
      };
    });
  }

  /** Map unknown provider names onto known entities. */
  async matchEntities(
    entityType: "team" | "player",
    unknownNames: string[],
    known: { id: string; name: string; hint?: string }[],
  ): Promise<
    { providerName: string; canonicalId: string | null; confidence: number; reasoning: string }[]
  > {
    if (unknownNames.length === 0) return [];
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Match each ${entityType} name from a data provider to one of our known ${entityType}s, or null.\n\nProvider names:\n${JSON.stringify(unknownNames)}\n\nKnown ${entityType}s (id, name, hint):\n${JSON.stringify(known)}`,
        },
      ],
      output_config: { format: zodOutputFormat(EntityMatch) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output)
      return unknownNames.map((n) => ({
        providerName: n,
        canonicalId: null,
        confidence: 0,
        reasoning: "model declined",
      }));
    const knownIds = new Set(known.map((k) => k.id));
    return response.parsed_output.matches.map((m) => ({
      providerName: m.provider_name,
      canonicalId:
        m.canonical_id && knownIds.has(m.canonical_id) && m.confidence >= this.minConfidence
          ? m.canonical_id
          : null,
      confidence: m.confidence,
      reasoning: m.reasoning,
    }));
  }
}
