import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { resetPassword } from "@/lib/auth";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string | undefined) ?? "" }),
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate({ to: "/" }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F1F1F] via-[#2E2E2E] to-[#4A4A4A] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-7 backdrop-blur">
          <h2 className="mb-5 font-serif text-xl font-bold">Set a new password</h2>

          {!token ? (
            <div className="rounded-md border border-[#D90429]/40 bg-[#D90429]/10 px-3 py-2 text-sm text-red-200">
              This link is missing its reset token — make sure you opened the link from the email exactly as sent.
            </div>
          ) : done ? (
            <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="mb-1 inline h-4 w-4" /> Password updated. Redirecting you to sign in…
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && <div className="mb-4 rounded-md border border-[#D90429]/40 bg-[#D90429]/10 px-3 py-2 text-sm text-red-200">{error}</div>}
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">New password</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mb-4 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
                placeholder="At least 8 characters"
              />
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">Confirm new password</label>
              <input
                type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="mb-5 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
                placeholder="Repeat password"
              />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] hover:opacity-90 disabled:opacity-50">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/" className="text-xs font-medium text-white/70 hover:underline">← Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
