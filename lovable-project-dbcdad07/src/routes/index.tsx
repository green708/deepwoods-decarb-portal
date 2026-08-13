import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  ForgotPassword,
  LoginForm,
  PasswordChange,
  type AuthView,
} from "@/components/auth/AuthScreens";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in | Deepwoods Decarb Portal" },
      {
        name: "description",
        content:
          "Sign in to the Deepwoods Decarb Portal to measure, understand and reduce your organisation's greenhouse gas emissions.",
      },
      { property: "og:title", content: "Sign in | Deepwoods Decarb Portal" },
      {
        property: "og:description",
        content:
          "Secure access to your organisation's sustainability workspace — from measuring emissions to meaningful reduction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [view, setView] = useState<AuthView>("signin");

  return (
    <AuthLayout>
      {view === "signin" && <LoginForm onNavigate={setView} />}
      {view === "forgot" && <ForgotPassword onNavigate={setView} />}
      {view === "change" && <PasswordChange onNavigate={setView} />}
    </AuthLayout>
  );
}
