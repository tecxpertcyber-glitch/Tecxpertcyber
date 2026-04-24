import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "System Terminal",
  description: "Interactive hacker-themed terminal experience.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HackerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
