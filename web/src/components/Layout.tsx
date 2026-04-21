import { Link } from "react-router-dom";
import type { PropsWithChildren } from "react";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      <div className="pointer-events-none fixed bottom-3 left-3 text-xs text-amber-200/70">
        <Link to="/" className="pointer-events-auto rounded-md bg-black/35 px-2 py-1">
          Ponagar Heritage Game
        </Link>
      </div>
    </div>
  );
}
