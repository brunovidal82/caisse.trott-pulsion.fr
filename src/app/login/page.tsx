import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/features/auth/LoginPage";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <LoginPage />
    </Suspense>
  );
}
