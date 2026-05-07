import { NextResponse } from "next/server";

function clearSession(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });

  response.cookies.set("ea_session_user", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}

export async function POST(request: Request) {
  return clearSession(request);
}

export async function GET(request: Request) {
  return clearSession(request);
}
