import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/** The share-card routes, which must answer where they are asked. */
const CARD = /\/opengraph-image(\/|$|\?)/;

/**
 * Detects the visitor's language (cookie, then Accept-Language) and routes to
 * /ar when needed.
 *
 * Share cards are the exception. English lives at the bare path, so the locale
 * routing answers `/en/anything/opengraph-image` with a redirect to the
 * unprefixed one — and Next writes exactly that prefixed address into
 * `og:image`. Browsers and most crawlers follow the redirect; WhatsApp's link
 * preview does not, which is why a link pasted into a chat arrived with no
 * picture on it while the same link on Twitter had one. The Arabic card, whose
 * address is already prefixed, always worked.
 *
 * So a card is served wherever it is asked for: prefixed, straight through;
 * unprefixed, rewritten to the default locale rather than redirected. Both
 * addresses answer 200 with the same image.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (CARD.test(pathname)) {
    const prefixed = routing.locales.some(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    );
    if (prefixed) return NextResponse.next();
    return NextResponse.rewrite(new URL(`/${routing.defaultLocale}${pathname}`, req.url));
  }
  return intl(req);
}

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
