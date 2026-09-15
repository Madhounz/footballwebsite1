"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted">
        {error.digest ? `Reference ${error.digest}` : error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink"
      >
        Try again
      </button>
    </div>
  );
}
