import Link from "next/link";
import { Mark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <Mark size={40} className="text-faint" />
      <h1 className="text-2xl font-semibold tracking-tight">Off the pitch</h1>
      <p className="text-muted">
        That page does not exist, or the club, player or match has moved.
      </p>
      <Link href="/" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink">
        Today’s matches
      </Link>
    </div>
  );
}
