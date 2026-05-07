import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const quickStats = [
  { label: "Accounts Connected", value: "12" },
  { label: "Open Positions", value: "37" },
  { label: "Win Rate 30D", value: "68.4%" },
];

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("ea_session_user")?.value;

  if (sessionUser) {
    redirect("/dashboard");
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden login-grid text-slate-100">
      <div className="orb orb-a" />
      <div className="orb orb-b" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <section className="grid w-full gap-6 rounded-3xl border border-white/10 bg-slate-900/55 p-5 shadow-[0_24px_100px_rgba(14,165,233,0.22)] backdrop-blur-xl md:grid-cols-[1.08fr_1fr] md:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-200 uppercase">
              <span className="status-pulse inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              EA Dashboard
            </div>

            <div className="space-y-3">
              <p className="text-sm tracking-[0.2em] text-sky-200 uppercase">
                MT5 Performance Monitor
              </p>
              <h1 className="text-3xl leading-tight font-semibold text-white md:text-5xl">
                Pantau performa bot trading
                <span className="block text-sky-200">secara realtime.</span>
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-slate-300 md:text-base">
                Satu dashboard untuk melihat account health, open position, dan
                metrik strategi EA Anda dengan cepat.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {quickStats.map((stat) => (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <p className="text-xs text-slate-400">{stat.label}</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-white">
                    {stat.value}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-5 md:p-7">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-white">Login</h2>
              <p className="text-sm text-slate-400">
                Masuk untuk mengakses ringkasan performa EA.
              </p>
            </div>

            <form
              method="POST"
              action="/api/login"
              className="mt-6 space-y-4"
            >
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-slate-200"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="contoh: trader.pro"
                  className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 text-slate-100 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-400/30"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-200"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="masukkan password"
                  className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 text-slate-100 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-400/30"
                />
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-sky-300 font-semibold text-slate-950 transition hover:bg-sky-200"
              >
                Masuk Dashboard
              </button>
            </form>

            <p className="mt-4 text-xs text-slate-500">
              Gunakan akun yang sudah terdaftar di database.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
