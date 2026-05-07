import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginAnimatedView from "./login-animated-view";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

type LoginPageProps = {
  searchParams: Promise<SearchParams>;
};

function getErrorMessage(error: string | undefined) {
  if (error === "invalid") {
    return "Username atau password salah.";
  }

  if (error === "required") {
    return "Username dan password wajib diisi.";
  }

  if (error === "server") {
    return "Terjadi gangguan saat login. Coba lagi beberapa saat.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("ea_session_user")?.value;
  const query = await searchParams;
  const errorParam = query.error;
  const errorCode = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  if (sessionUser) {
    redirect("/dashboard");
  }

  return <LoginAnimatedView errorMessage={getErrorMessage(errorCode)} />;
}
