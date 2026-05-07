function Block({ className }: { className: string }) {
  return <div className={`rounded bg-slate-200 ${className}`} />;
}

function SectionShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      {children}
    </section>
  );
}

export default function EaLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SectionShell>
        <Block className="h-4 w-20" />
        <Block className="mt-4 h-8 w-72" />
        <div className="mt-6 flex flex-wrap gap-3">
          <Block className="h-12 w-44 rounded-2xl" />
          <Block className="h-12 w-44 rounded-2xl" />
        </div>
      </SectionShell>

      <SectionShell>
        <Block className="h-4 w-16" />
        <Block className="mt-4 h-7 w-60" />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Block className="h-12 w-full rounded-xl" />
          <Block className="h-12 w-full rounded-xl" />
          <Block className="h-12 w-full rounded-xl" />
          <Block className="h-12 w-full rounded-xl" />
          <Block className="h-12 w-full rounded-xl" />
          <Block className="h-12 w-full rounded-xl" />
        </div>
      </SectionShell>

      <SectionShell>
        <Block className="h-4 w-44" />
        <Block className="mt-4 h-7 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <Block className="h-4 w-24" />
              <Block className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell>
        <Block className="h-7 w-56" />
        <div className="mt-6 h-72 rounded-2xl border border-slate-200 bg-slate-50" />
      </SectionShell>
    </div>
  );
}
