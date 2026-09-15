import type { Metadata } from "next";
import { Mark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "About",
  description: "Why ninety exists and how its data is kept right.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-4">
        <Mark size={48} className="text-ink" />
        <h1 className="text-3xl font-semibold tracking-tight">Ninety minutes. Nothing else.</h1>
        <p className="text-lg leading-relaxed text-muted">
          ninety is a scores site built for people who just want to know what happened, what is
          happening, and what is next — in the competitions they actually follow.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Why</h2>
        <p className="leading-relaxed">
          The big scores sites have become hard to use: crowded pages, pop-ups, and a league table
          three taps away. We think a fan should open one page and see today’s matches, flip to
          yesterday or tomorrow in a single tap, and reach any table, squad or match in two.
        </p>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>No adverts, no pop-ups, no cookie theatre.</li>
          <li>Six competitions followed properly instead of two hundred followed badly.</li>
          <li>Every score, table and squad reachable in two taps. Search with ⌘K.</li>
          <li>Light or dark, fast on a phone, readable at a glance.</li>
        </ul>
      </section>

      <section className="space-y-3" id="data">
        <h2 className="text-xl font-semibold tracking-tight">How the data is kept right</h2>
        <p className="leading-relaxed">
          ninety never trusts a single source. A sync pipeline pulls each fixture, result and squad
          from several licensed data providers, normalises them into one model, and compares them
          field by field.
        </p>
        <ol className="list-decimal space-y-2 ps-5 leading-relaxed">
          <li>
            <span className="font-medium">Fetch.</span> Every configured provider is queried for the
            same window of matches and the same competitions.
          </li>
          <li>
            <span className="font-medium">Normalise.</span> Team and player names are mapped to
            canonical identities, so “Man Utd”, “Manchester United FC” and “Manchester United” are
            one club.
          </li>
          <li>
            <span className="font-medium">Reconcile.</span> When providers agree, the value is
            written with full confidence. When they disagree, the majority wins if there is one, and
            the disagreement is logged.
          </li>
          <li>
            <span className="font-medium">Resolve with AI.</span> Remaining conflicts (a scoreline
            that differs, a scorer credited differently, an ambiguous club name) are handed to a
            Claude model with all the evidence. It returns a decision, a confidence and its
            reasoning, and anything below the confidence bar is held for a human.
          </li>
          <li>
            <span className="font-medium">Derive, never copy.</span> League tables and scorer charts
            are computed from the results stored here, so a table can never disagree with the
            results you can click on.
          </li>
        </ol>
        <p className="text-sm leading-relaxed text-muted">
          Deployments that show a{" "}
          <span className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11px] font-medium">
            Demo data
          </span>{" "}
          badge run on a synthetic season generated for development: real clubs and competitions,
          but fictional results, squads and players.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">The name</h2>
        <p className="leading-relaxed">
          A match lasts ninety minutes. The mark is a pitch seen from above: the halfway line, the
          centre circle, the spot where every game starts. The prime after the name is the minute
          mark on a match clock — 90′.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">What is next</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>Knockout brackets for the Champions League and Europa League.</li>
          <li>Arabic interface with full right-to-left layout.</li>
          <li>Follow your clubs for a personal home page.</li>
          <li>Written analysis from invited critics.</li>
        </ul>
      </section>
    </article>
  );
}
