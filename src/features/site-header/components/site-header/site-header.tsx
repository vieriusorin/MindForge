import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SiteHeaderProps } from "./types";

export function SiteHeader({ signedIn, signOutAction }: SiteHeaderProps) {
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      {signedIn ? (
        <>
          <Button variant="ghost" asChild>
            <Link href="/today">Dashboard</Link>
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      )}
    </nav>
  );
}
