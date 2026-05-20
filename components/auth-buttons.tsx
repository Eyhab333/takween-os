// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { auth } from "@/lib/firebase";
// import { signOut } from "firebase/auth";
// import { useEffect, useState } from "react";
// import { Button } from "@/components/ui/button";

// export function AuthButtons() {
//   const pathname = usePathname();
//   const [user, setUser] = useState(() => auth.currentUser);

//   useEffect(() => {
//     return auth.onAuthStateChanged((u) => setUser(u));
//   }, []);

//   if (user) {
//     return (
//       <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
//         خروج
//       </Button>
//     );
//   }

//   return (
//     <Button asChild variant="outline" size="sm">
//       <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
//         تسجيل الدخول
//       </Link>
//     </Button>
//   );
// }

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AuthButtons() {
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <Button variant="outline" size="sm" disabled>
        ...
      </Button>
    );
  }

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
