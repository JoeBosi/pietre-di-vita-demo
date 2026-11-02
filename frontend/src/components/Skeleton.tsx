export function BottleSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" role="status">
      <div className="skeleton h-10 w-3/4" /><div className="skeleton h-5 w-1/2" /><div className="skeleton h-20 w-full" />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton h-36 w-full" />)}
    </div>
  );
}
