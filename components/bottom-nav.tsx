"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Activity,
  Layers,
  Settings,
  BookOpen,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: Item[] = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/ibadah", label: "الشريعة", icon: BookOpen },
  { href: "/aspects", label: "الجوانب", icon: Layers },
  { href: "/explorer", label: "المستكشف", icon: Compass },
  { href: "/activity", label: "النشاط", icon: Activity },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 px-2 py-1">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;

          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs",
                active
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
