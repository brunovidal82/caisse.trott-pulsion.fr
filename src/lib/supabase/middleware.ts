import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function rediriger(request: NextRequest, pathname: string, erreur?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (erreur) url.searchParams.set("error", erreur);
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url?.trim() || !key?.trim()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname === "/login";

  if (!user) {
    return isLogin ? supabaseResponse : rediriger(request, "/login");
  }

  const { data: autorise, error } = await supabase
    .schema("caisse")
    .rpc("est_vendeur");
  const accesOk = !error && autorise === true;

  if (isLogin) {
    return accesOk ? rediriger(request, "/") : supabaseResponse;
  }

  if (error) {
    return rediriger(request, "/login", "config");
  }

  if (!accesOk) {
    await supabase.auth.signOut();
    return rediriger(request, "/login", "unauthorized");
  }

  return supabaseResponse;
}
