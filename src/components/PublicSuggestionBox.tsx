"use client";

import { usePathname } from "next/navigation";
import SuggestionBox from "./SuggestionBox";

/**
 * Mounts the SuggestionBox on every page EXCEPT the admin and hacker routes.
 */
export default function PublicSuggestionBox() {
  const pathname = usePathname();
  const path = pathname || "/";
  if (path.startsWith("/admin") || path.startsWith("/hacker")) return null;
  return <SuggestionBox />;
}
