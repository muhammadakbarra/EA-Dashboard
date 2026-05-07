function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="h-4 w-28 rounded bg-slate-200" />
      <div className="mt-3 h-7 w-20 rounded bg-slate-300" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="mt-4 h-5 w-80 rounded bg-slate-200" />
        <div className="mt-2 h-5 w-72 rounded bg-slate-200" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    </div>
  );
}
