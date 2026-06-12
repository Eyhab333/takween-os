// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { SheetClose } from "@/components/ui/sheet";

// const LINKS = [
//   { href: "/", label: "الرئيسية" },
//   { href: "/vision", label: "تنفيذ الرؤية" },
//   { href: "/weekly", label: "أسبوعي" },
//   { href: "/ibadah", label: "الشريعة والإصلاح" },
//   { href: "/aspects", label: "بقية الجوانب" },

//   { href: "/settings", label: "الإعدادات" },
// ];

// function isActive(href: string, pathname: string) {
//   if (href === "/") return pathname === "/";
//   return pathname === href || pathname.startsWith(href + "/");
// }

// export function NavLinks({ closeOnClick = false }: { closeOnClick?: boolean }) {
//   const pathname = usePathname();

//   return (
//     <nav className="space-y-2 text-sm">
//       {LINKS.map((l) => {
//         const active = isActive(l.href, pathname);
//         const cls = [
//           "block rounded-md px-3 py-2 hover:bg-muted",
//           active ? "bg-muted font-bold text-foreground" : "",
//         ].join(" ");

//         const linkEl = (
//           <Link
//             href={l.href}
//             className={cls}
//             aria-current={active ? "page" : undefined}
//           >
//             {l.label}
//           </Link>
//         );

//         return closeOnClick ? (
//           <SheetClose asChild key={l.href}>
//             {linkEl}
//           </SheetClose>
//         ) : (
//           <span key={l.href}>{linkEl}</span>
//         );
//       })}
//     </nav>
//   );
// }

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SheetClose } from "@/components/ui/sheet";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/vision", label: "تنفيذ الرؤية" },
  { href: "/weekly", label: "أسبوعي" },
  { href: "/ibadah", label: "الشريعة والإصلاح" },
  { href: "/aspects", label: "بقية الجوانب" },
  // { href: "/settings", label: "الإعدادات" },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLinks({ closeOnClick = false }: { closeOnClick?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2 text-sm">
      {LINKS.map((l) => {
        const active = isActive(l.href, pathname);

        const cls = [
          "block rounded-xl border px-3 py-2.5 transition-all",
          active
            ? "border-primary/35 bg-primary/10 font-extrabold text-primary shadow-[0_0_18px_rgba(234,179,8,0.12)]"
            : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/70 hover:text-foreground",
        ].join(" ");

        const linkEl = (
          <Link
            href={l.href}
            className={cls}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
          </Link>
        );

        return closeOnClick ? (
          <SheetClose asChild key={l.href}>
            {linkEl}
          </SheetClose>
        ) : (
          <span key={l.href}>{linkEl}</span>
        );
      })}
    </nav>
  );
}
