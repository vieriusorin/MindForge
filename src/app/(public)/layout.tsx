import Link from "next/link";
import { Suspense } from "react";
import { ModeToggle } from "@/features/app-shell/components/mode-toggle";
import { signOut } from "@/features/auth/actions";
import { SiteHeader } from "@/features/site-header/components/site-header";
import { getCurrentUser } from "@/server/auth/current-user";

async function AccountNav() {
  const user = await getCurrentUser();
  return <SiteHeader signedIn={user !== null} signOutAction={signOut} />;
}

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
        >
          <span aria-hidden className="bg-hero size-7 rounded-lg" />
          MindForge
        </Link>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}
