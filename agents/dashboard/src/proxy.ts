import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// أي صفحة غير /login محتاجة تسجيل دخول. ده للراحة بس:
// الحماية الحقيقية في قاعدة البيانات (RLS)، فحتى لو حد عدّى من هنا مش هيشوف بيانات.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: cookies => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await db.auth.getUser();
  const onLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !onLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  // /api/telegram ليه حمايته الخاصة (secret token + chat id)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/telegram).*)"],
};
