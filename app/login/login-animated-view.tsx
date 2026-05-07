"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";

const STANDBY_PEAK = { x: 50, y: 88, active: false };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type LoginAnimatedViewProps = {
  errorMessage: string | null;
};

export default function LoginAnimatedView({
  errorMessage,
}: LoginAnimatedViewProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [peak, setPeak] = useState(STANDBY_PEAK);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setStandby = () => {
    setPeak((current) =>
      current.x === STANDBY_PEAK.x &&
      current.y === STANDBY_PEAK.y &&
      current.active === STANDBY_PEAK.active
        ? current
        : STANDBY_PEAK,
    );
  };

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const isInsideCard = cardRef.current?.contains(event.target as Node);

    if (isInsideCard) {
      setStandby();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setPeak({
      x: clamp(x, 4, 96),
      y: clamp(y, 6, 92),
      active: true,
    });
  };

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }

    setIsSubmitting(true);
  };

  return (
    <main
      onMouseMove={handleMouseMove}
      onMouseLeave={setStandby}
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-12"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 will-change-[clip-path,opacity] transition-[clip-path,opacity] duration-200 ease-out"
          style={{
            clipPath: `polygon(0% 100%, 100% 100%, ${peak.x}% ${peak.y}%)`,
            opacity: peak.active ? 0.92 : 0.8,
            background:
              "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 55%, #2dd4bf 100%)",
          }}
        />
        <div
          className="absolute inset-0 transition-opacity duration-200 ease-out"
          style={{
            opacity: peak.active ? 0.28 : 0.18,
            background:
              "radial-gradient(55rem 20rem at 50% 100%, rgba(14, 165, 233, 0.24), transparent 70%)",
          }}
        />
      </div>

      <section
        ref={cardRef}
        className="relative z-10 w-full max-w-2xl rounded-3xl bg-blue-950 p-10 text-white shadow-xl sm:p-12"
      >
        <h1 className="text-4xl font-semibold">EA Dashboard</h1>
        <p className="mt-3 text-lg text-blue-100">
          Masuk untuk melihat performa dan ringkasan akun trading Anda.
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-300/30 bg-red-500/15 px-4 py-3 text-base text-red-100"
          >
            {errorMessage}
          </p>
        ) : null}

        <form
          method="POST"
          action="/api/login"
          onSubmit={handleLoginSubmit}
          className="mt-8 space-y-6"
        >
          <div className="space-y-3">
            <label htmlFor="username" className="text-base font-medium text-blue-100">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="Masukkan username"
              className="h-14 w-full rounded-xl border border-blue-700 bg-blue-900 px-4 text-lg text-white outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300/40"
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="password" className="text-base font-medium text-blue-100">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Masukkan password"
              className="h-14 w-full rounded-xl border border-blue-700 bg-blue-900 px-4 text-lg text-white outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300/40"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-white text-lg font-semibold text-blue-950 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-blue-100"
          >
            {isSubmitting ? (
              <span
                aria-label="Loading"
                className="h-6 w-6 animate-spin rounded-full border-[3px] border-blue-950/35 border-t-blue-950"
              />
            ) : (
              "Login"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-blue-200">
          Copyright by bangunwebsite.id
        </p>
      </section>
    </main>
  );
}
