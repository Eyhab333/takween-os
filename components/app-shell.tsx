"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/auth-buttons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { useState } from "react";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-2 text-sm">
      <Link
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 hover:bg-muted"
        href="/"
      >
        الرئيسية
      </Link>
      <Link
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 hover:bg-muted"
        href="/ibadah"
      >
        العبودية والإصلاح
      </Link>
      <Link
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 hover:bg-muted"
        href="/aspects"
      >
        بقية الجوانب
      </Link>
      {/* <Link onClick={onNavigate} className="block rounded-md px-3 py-2 hover:bg-muted" href="/years">السنوات</Link> */}
      <Link
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 hover:bg-muted"
        href="/explorer"
      >
        المستكشف
      </Link>
      <Link
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 hover:bg-muted"
        href="/activity"
      >
        النشاط
      </Link>
      <Link
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 hover:bg-muted"
        href="/settings"
      >
        الإعدادات
      </Link>
    </nav>
  );
}

function DesktopSidebar() {
  return (
    <aside className="hidden min-h-dvh border-l bg-card/30 p-4 lg:block">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">مزرعة الاخرة</div>
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
        <div className="text-sm font-bold">مزرعة الاخرة</div>

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
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MobileTopbar />

      <div className="lg:grid lg:grid-cols-[280px_1fr]">
        {/* sidebar يمين في RTL: نخليه أول عمود */}
        <DesktopSidebar />

        <main className="min-h-dvh p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
