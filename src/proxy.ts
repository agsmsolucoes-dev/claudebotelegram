import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic Auth pra /admin — painel interno (sem cadastro de usuários ainda).
 * Define ADMIN_PASSWORD no .env / Vercel pra habilitar o acesso.
 */
export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return new Response("ADMIN_PASSWORD não configurado", { status: 500 });
  }

  const auth = req.headers.get("authorization");
  const expected = `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;

  if (auth !== expected) {
    return new Response("Autenticação necessária", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
