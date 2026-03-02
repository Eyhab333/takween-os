"use client";

import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { bootstrapUserIfNeeded } from "@/lib/bootstrap";
import { ensureAspectsTemplate } from "@/lib/templates/aspects";

export function AuthButtons() {
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) await bootstrapUserIfNeeded(u.uid);
      if (u) await ensureAspectsTemplate(u.uid);
    });
  }, []);

  if (user) {
    return (
      <button
        className="rounded-md border px-3 py-1 text-sm"
        onClick={() => signOut(auth)}
      >
        خروج
      </button>
    );
  }

  return (
    <button
      className="rounded-md border px-3 py-1 text-sm"
      onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
    >
      دخول Google
    </button>
  );
}
