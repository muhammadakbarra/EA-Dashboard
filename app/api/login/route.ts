import { NextResponse } from "next/server";

import { query } from "@/lib/db";

type LoginUser = {
  id: number;
  username: string;
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || request.url),
      {
        status: 303,
      },
    );
  }

  try {
    const result = await query<LoginUser>(
      `SELECT id, username
       FROM users
       WHERE username = $1
         AND password_hash = crypt($2, password_hash)
       LIMIT 1`,
      [username, password],
    );

    if (!result.rowCount) {
      return NextResponse.redirect(
        new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || request.url),
        {
          status: 303,
        },
      );
    }

    const user = result.rows[0];
    const response = NextResponse.redirect(
      new URL("/dashboard", process.env.NEXT_PUBLIC_BASE_URL || request.url),
      {
        status: 303,
      },
    );

    response.cookies.set("ea_session_user", user.username, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || request.url),
      {
        status: 303,
      },
    );
  }
}
