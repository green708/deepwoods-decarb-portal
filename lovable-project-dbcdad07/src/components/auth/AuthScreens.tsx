import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(false);
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 1100);
  };

  return (
    <div className="space-y-7">
      <Heading
        title="Sign in to your workspace"
        subtitle="Access your organisation's Decarb Portal."
      />

      <form onSubmit={submit} noValidate className="space-y-5">
        <div aria-live="polite">
          {error && (
            <AuthError title="Unable to sign in">
              Please check your email address and password and try again.
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
          invalid={error}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label="Password"
          name="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          invalid={error}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.8125rem] text-foreground">
            <input
              type="checkbox"
              name="remember"
              className="size-4 rounded-[4px] border border-border-strong accent-[var(--primary)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
            />
            Remember me
          </label>
          <TextLink onClick={() => onNavigate("forgot")}>Forgot password?</TextLink>
        </div>

        <PrimaryButton loading={loading}>Sign in</PrimaryButton>
      </form>

      <div className="space-y-3 border-t border-border pt-5">
        <SecurityNote>
          Secure access to your organisation's sustainability workspace.
        </SecurityNote>
        <p className="text-xs text-muted-foreground">
          Invited by your organisation?{" "}
          <TextLink onClick={() => onNavigate("change")}>Set your password</TextLink>
        </p>
      </div>
    </div>
  );
}

/* --------------------------- Forgot password --------------------------- */

export function ForgotPassword({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1000);
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
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const met = RULES.filter((r) => r.test(next)).length;
  const strength = next ? met : 0;
  const strengthLabel = ["Too weak", "Weak", "Fair", "Strong", "Very strong"][strength];
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading || mismatch || met < RULES.length) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 1000);
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
          <PasswordField
            label="Temporary password"
            name="current-password"
            placeholder="Enter your temporary password"
            autoComplete="current-password"
            required
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
