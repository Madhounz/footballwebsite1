export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-64 animate-pulse rounded-md bg-surface-2" />
      <div className="h-9 w-96 max-w-full animate-pulse rounded-full bg-surface-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-40 animate-pulse" />
      ))}
    </div>
  );
}
