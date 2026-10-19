import { useState, type FormEvent } from "react";
import { ArrowLeft, Leaf, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { login, loginDemo, forgotPassword, changePassword, getRole, DEEPWOODS_ROLES } from "@/lib/auth";
import {
  AuthError,
  AuthSuccess,
  FormField,
  PasswordField,
  PrimaryButton,
  SecurityNote,
  TextLink,
} from "./primitives";

export type AuthView = "signin" | "forgot" | "change";

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="animate-rise">
      <h2 className="text-[1.75rem] font-bold leading-tight tracking-[-0.015em] text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-sm text-[0.8125rem] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Back to sign in
    </button>
  );
}

/* ------------------------------- Sign in ------------------------------- */

export function LoginForm({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const role = getRole();
      navigate({ to: DEEPWOODS_ROLES.includes(role as never) ? "/admin" : "/register" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please check your email address and password and try again.");
      setLoading(false);
    }
  };

  const handleDemo = () => {
    loginDemo();
    const orientationDone = localStorage.getItem("decarb_orientation_done");
    navigate({ to: orientationDone ? "/home" : "/onboard" });
  };

  return (
    <div className="space-y-6">
      <Heading
        title="Sign in"
        subtitle="Welcome back — access your decarbonisation workspace."
      />

      {/* DECARB accent strip */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1E6F5C", display: "inline-block", opacity: 0.5 }} />
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", display: "inline-block", opacity: 0.5 }} />
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#64748B", display: "inline-block", opacity: 0.5 }} />
          </span>
          <span className="text-[0.6rem] font-black tracking-[0.38em] uppercase text-foreground/25">Decarb</span>
          <Leaf className="size-2.5 text-foreground/20" aria-hidden />
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} noValidate className="space-y-5">
        <div aria-live="polite">
          {error && (
            <AuthError title="Unable to sign in">
              {error}
            </AuthError>
          )}
        </div>

        <FormField
          label="Email address"
          type="email"
          name="email"
          placeholder="name@company.com"
          autoComplete="email"
          required
          invalid={!!error}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label="Password"
          name="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          invalid={!!error}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          action={
            <TextLink onClick={() => onNavigate("forgot")}>Forgot password?</TextLink>
          }
        />

        <PrimaryButton loading={loading}>Sign in</PrimaryButton>
      </form>

      <div className="space-y-4 border-t border-border pt-5">
        {/* New client CTA — distinctive dark-green gradient banner */}
        <Link
          to="/request-access"
          className="group block w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1E6F5C]/40"
        >
          <div
            className="transition-opacity group-hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #1E4D2B 0%, #1E6F5C 100%)", padding: "16px 20px" }}
          >
            <p className="mb-0.5 text-[0.6rem] font-bold uppercase tracking-[0.22em] text-white/55">New Organisation</p>
            <p className="text-[0.9rem] font-bold leading-snug text-white">Start your decarbonisation journey</p>
            <p className="mt-0.5 text-[0.72rem] text-white/65">GHG baseline → action plan → certified report</p>
            <p className="mt-2.5 text-[0.72rem] font-semibold text-[#86EFAC]">Request access →</p>
          </div>
        </Link>

        {/* Demo access — Featherlite live portal preview */}
        <button
          type="button"
          onClick={handleDemo}
          className="group flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-[#1E6F5C]/40 hover:bg-[#F0FDF4] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1E6F5C]/25"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
              <img src="/featherlite-logo.png" alt="Featherlite" className="size-7 object-contain" />
            </div>
            <div>
              <p className="text-[0.875rem] font-semibold text-foreground">Featherlite demo</p>
              <p className="text-[0.72rem] text-muted-foreground">Explore the live FY25 portal — no login needed</p>
            </div>
          </div>
          <ChevronRight className="size-4 flex-shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1E6F5C]" aria-hidden />
        </button>

        <SecurityNote>
          Secure access to your organisation's sustainability workspace.
        </SecurityNote>
      </div>
    </div>
  );
}

/* --------------------------- Forgot password --------------------------- */

export function ForgotPassword({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) return;
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // show success regardless — don't reveal account existence
    }
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="space-y-7">
      <Heading
        title={sent ? "Check your inbox" : "Reset your password"}
        subtitle={
          sent
            ? "We've sent instructions to reset your password."
            : "Enter your work email and we'll send you instructions to securely reset your password."
        }
      />

      {sent ? (
        <div className="space-y-6">
          <AuthSuccess title="Instructions sent">
            If an account matches that address, reset instructions are on their way. The link
            expires in 30 minutes.
          </AuthSuccess>
          <BackLink onClick={() => onNavigate("signin")} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <FormField
            label="Work email"
            type="email"
            name="email"
            placeholder="name@company.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PrimaryButton loading={loading} loadingLabel="Sending…">
            Send reset link
          </PrimaryButton>
          <BackLink onClick={() => onNavigate("signin")} />
        </form>
      )}

      <div className="border-t border-border pt-5">
        <SecurityNote>
          Secure access to your organisation's sustainability workspace.
        </SecurityNote>
      </div>
    </div>
  );
}

/* --------------------------- Password change --------------------------- */

const RULES = [
  { label: "At least 12 characters", test: (v: string) => v.length >= 12 },
  { label: "Upper and lowercase letters", test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "At least one number", test: (v: string) => /\d/.test(v) },
  { label: "At least one symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function PasswordChange({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const met = RULES.filter((r) => r.test(next)).length;
  const strength = next ? met : 0;
  const strengthLabel = ["Too weak", "Weak", "Fair", "Strong", "Very strong"][strength];
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || mismatch || met < RULES.length || !current.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password. Check your temporary password and try again.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-7">
      <Heading
        title="Secure your account"
        subtitle="For your security, create a new password before continuing."
      />

      {done ? (
        <div className="space-y-6">
          <AuthSuccess title="Password updated">
            Your new password is active. You can now sign in to your workspace.
          </AuthSuccess>
          <BackLink onClick={() => onNavigate("signin")} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div aria-live="polite">
            {error && (
              <AuthError title="Password update failed">{error}</AuthError>
            )}
          </div>

          <PasswordField
            label="Temporary password"
            name="current-password"
            placeholder="Enter your temporary password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <PasswordField
            label="New password"
            name="new-password"
            placeholder="Create a new password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />

          <div className="space-y-2.5 rounded-md border border-border bg-muted/60 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-foreground">Password strength</span>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {strengthLabel}
              </span>
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {RULES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                    i < strength ? "bg-primary" : "bg-border-strong"
                  }`}
                />
              ))}
            </div>
            <ul className="space-y-1 pt-0.5">
              {RULES.map((r) => {
                const ok = r.test(next);
                return (
                  <li
                    key={r.label}
                    className={`flex items-center gap-2 text-xs ${ok ? "text-primary-deep" : "text-muted-foreground"}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${ok ? "bg-primary" : "bg-border-strong"}`}
                      aria-hidden
                    />
                    {r.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <PasswordField
            label="Confirm new password"
            name="confirm-password"
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            required
            invalid={mismatch}
            hint={mismatch ? "Both passwords must match." : undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <PrimaryButton loading={loading} loadingLabel="Saving…">
            Set new password
          </PrimaryButton>
          <BackLink onClick={() => onNavigate("signin")} />
        </form>
      )}

      <div className="border-t border-border pt-5">
        <SecurityNote>
          Secure access to your organisation's sustainability workspace.
        </SecurityNote>
      </div>
    </div>
  );
}
