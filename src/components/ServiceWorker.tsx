"use client";

import { useEffect } from "react";

/**
 * Registers the worker that makes the site installable and readable offline.
 *
 * Only in production: a worker caching a development build is a good way to
 * spend an afternoon wondering why a change will not appear. Registration waits
 * for load so it never competes with the first paint for bandwidth.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A browser that refuses it simply does not get the offline copy.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
