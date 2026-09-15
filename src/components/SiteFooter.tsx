import Link from "next/link";
import type { DataSourceInfo } from "@/lib/types";
import { Mark } from "./Logo";

export function SiteFooter({ info }: { info: DataSourceInfo }) {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-ink">
            <Mark size={20} />
            <span className="font-semibold tracking-tight">ninety</span>
          </div>
          <p className="max-w-xs leading-relaxed">
            Ninety minutes. Nothing else. Scores, tables, squads and history for the competitions
            that matter, without the noise.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-faint">Data</div>
          <p className="leading-relaxed">
            <span className="text-ink">{info.label}.</span> {info.freshness}
          </p>
          <Link href="/about#data" className="inline-block text-accent hover:underline">
            How we keep it right →
          </Link>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-faint">Shortcuts</div>
          <ul className="space-y-1">
            <li>
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[11px]">
                ⌘K
              </kbd>{" "}
              search
            </li>
            <li>
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[11px]">
                /
              </kbd>{" "}
              search
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-faint sm:px-6">
          <span>
            © {new Date().getUTCFullYear()} ninety. Not affiliated with any league, club or
            federation.
          </span>
          <span>Kickoff times shown in your local time.</span>
        </div>
      </div>
    </footer>
  );
}
