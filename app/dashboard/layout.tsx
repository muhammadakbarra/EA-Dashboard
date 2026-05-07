import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Docs", href: "/dashboard/docs" },
  { label: "EA", href: "/dashboard/ea" },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("ea_session_user")?.value;

  if (!sessionUser) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen w-full bg-slate-100 text-slate-900">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-8 lg:border-r lg:border-b-0">
          <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
            EA Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900">
            Control Panel
          </h1>
          <p className="mt-4 text-lg text-slate-600">Halo, {sessionUser}</p>

          <nav className="mt-10 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left text-lg font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form method="POST" action="/api/logout" className="mt-10">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-lg font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              Logout
            </button>
          </form>
        </aside>

        <section className="p-8 md:p-12">{children}</section>
      </div>
    </main>
  );
}
