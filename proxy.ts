import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (!request.cookies.has("duty_track_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/admin/:path*"],
};
