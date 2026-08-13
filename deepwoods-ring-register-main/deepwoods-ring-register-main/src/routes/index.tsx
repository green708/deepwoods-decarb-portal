import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-store";
import { RingWatermark, Wordmark, inputCls } from "@/components/portal/primitives";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Deepwoods GHG Portal" },
      {
        name: "description",
        content:
          "Sign in to the Deepwoods GHG Portal to manage your group's registered entities, emissions inventory and reporting.",
      },
      { property: "og:title", content: "Sign in — Deepwoods GHG Portal" },
      {
        property: "og:description",
        content: "Secure access to the Deepwoods greenhouse gas reporting portal.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const { login } = usePortal();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (login(user, pass)) navigate({ to: "/register" });
    else setError(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 text-ink">
      <RingWatermark />
      <div className="relative z-10 w-full max-w-[380px]">
        <form
          onSubmit={submit}
          className="rounded-[12px] border border-border bg-white p-7 shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
        >
          <Wordmark />
          <h1 className="mt-6 text-2xl font-bold">Sign in</h1>

          {error && (
            <div className="mt-4 rounded-md border border-coral bg-coral-tint px-3 py-2 text-sm text-coral">
              That username or password doesn't match our records.
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Email or username</label>
              <input
                className={inputCls}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
              />
              <p className="text-xs text-slate">
                Use the username or email issued when your organisation was set up with Deepwoods.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Password</label>
              <div className="relative">
                <input
                  className={inputCls + " pr-10"}
                  type={show ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-slate"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full cursor-pointer rounded-[6px] bg-canopy py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={() => toast("Contact your Deepwoods administrator to reset your password.")}
            className="mt-3 w-full cursor-pointer text-center text-sm text-coral hover:underline"
          >
            Forgot password?
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate">
          Demo credentials — Username: Featherlite Furnitures · Password: 123
        </p>
      </div>
    </div>
  );
}
