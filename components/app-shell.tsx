"use client";

// import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/auth-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { auth } from "@/lib/firebase";
import { bootstrapUserIfNeeded } from "@/lib/bootstrap";
import { ensureAspectsTemplate } from "@/lib/templates/aspects";
import { NavLinks } from "./nav-links";

function DesktopSidebar() {
  return (
    <aside className="hidden min-h-dvh border-l bg-card/30 p-4 lg:block">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">مزرعة الآخرة</div>
        <div className="flex items-center gap-2">
          <AuthButtons />
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-6">
        <NavLinks />
      </div>
    </aside>
  );
}

function MobileTopbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-3">
        <div className="text-sm font-bold">مزرعة الآخرة</div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                ☰
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-70">
              <SheetHeader>
                <SheetTitle className="text-right">القائمة</SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex items-center justify-between">
                <AuthButtons />
              </div>

              <div className="mt-6">
                <NavLinks closeOnClick />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

const AUTH_ROUTES_PREFIXES = ["/login", "/signup", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // إخفاء topbar/bottomnav في صفحات auth
  const isAuthRoute = AUTH_ROUTES_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  // منع تكرار التهيئة لنفس المستخدم أكثر من مرة في نفس الجلسة
  const bootstrappedForUid = useRef<string | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        bootstrappedForUid.current = null;
        return;
      }

      // نفس المستخدم اتعمله init بالفعل في نفس الجلسة
      if (bootstrappedForUid.current === u.uid) return;

      bootstrappedForUid.current = u.uid;

      // ترتيب التنفيذ: bootstrap ثم aspects
      await bootstrapUserIfNeeded(u.uid);
      await ensureAspectsTemplate(u.uid);
    });
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {!isAuthRoute ? <MobileTopbar /> : null}

      <div className={isAuthRoute ? "" : "lg:grid lg:grid-cols-[280px_1fr]"}>
        {!isAuthRoute ? <DesktopSidebar /> : null}

        <main
          className={
            isAuthRoute
              ? "min-h-dvh p-4 lg:p-6"
              : "min-h-dvh p-4 pb-24 lg:p-6 lg:pb-6"
          }
        >
          {children}
        </main>
      </div>

      {!isAuthRoute ? <BottomNav /> : null}
    </div>
  );
}
