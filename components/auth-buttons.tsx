"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AuthButtons() {
  const pathname = usePathname();
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  if (user) {
    return (
      <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
        خروج
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
        تسجيل الدخول
      </Link>
    </Button>
  );
}
