import { notFound } from "next/navigation";

/** Anything the other routes do not match is a 404 rendered inside the locale layout. */
export default function CatchAll() {
  notFound();
}
