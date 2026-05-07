"use client";

import type { FormEvent } from "react";

export default function LogoutButton() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const shouldLogout = window.confirm("Yakin ingin logout?");

    if (!shouldLogout) {
      event.preventDefault();
    }
  };

  return (
    <form method="POST" action="/api/logout" onSubmit={handleSubmit}>
      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-red-600 px-5 text-lg font-bold text-white transition hover:bg-red-700"
      >
        Logout
      </button>
    </form>
  );
}
