/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
    } catch (e: any) {
      setErr(e?.message || "تعذر إرسال رابط إعادة التعيين.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-right">إعادة تعيين كلمة المرور</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label className="block text-right" htmlFor="email">
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {msg ? (
              <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                {msg}
              </div>
            ) : null}

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                {err}
              </div>
            ) : null}

            <Button className="w-full" disabled={loading}>
              {loading ? "..." : "إرسال رابط إعادة التعيين"}
            </Button>
          </form>

          <div className="text-sm text-muted-foreground">
            <Link className="underline" href="/login">
              رجوع لتسجيل الدخول
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
