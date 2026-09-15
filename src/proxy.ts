import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Detects the visitor's language (cookie, then Accept-Language) and routes to /ar when needed. */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
