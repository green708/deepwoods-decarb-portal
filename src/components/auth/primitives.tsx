import { Eye, EyeOff, AlertCircle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Brand ---------------- */

export function BrandHeader({ inverted = false }: { inverted?: boolean }) {
  const logoSrc = inverted ? "/DW-reversed.webp" : "/deepwoods-logo.png";
  return (
    <div className="flex items-center gap-3">
      <img
        src={logoSrc}
        alt="Deepwoods Green"
        className="h-6 w-auto sm:h-7"
      />
      <span
        className={cn(
          "border-l pl-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
          inverted
            ? "border-white/25 text-white/75"
            : "border-border-strong text-muted-foreground",
        )}
      >
        Decarb Portal
      </span>
    </div>
  );
}

/* ---------------- Fields ---------------- */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  invalid?: boolean;
  action?: ReactNode;
};

const inputBase =
  "h-11 w-full rounded-md border bg-card px-3.5 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow,background-color] duration-200 hover:border-border-strong focus:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function FormField({ label, hint, invalid, action, className, id, ...props }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-[0.8125rem] font-semibold text-foreground">
          {label}
        </label>
        {action}
      </div>
      <input
        id={fieldId}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? hintId : undefined}
        className={cn(inputBase, invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25", className)}
        {...props}
      />
      {hint ? (
        <p id={hintId} className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({ label, hint, invalid, action, className, id, ...props }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-[0.8125rem] font-semibold text-foreground">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          id={fieldId}
          type={show ? "text" : "password"}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          className={cn(inputBase, "pr-12", invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          {show ? <EyeOff className="size-[1.05rem]" /> : <Eye className="size-[1.05rem]" />}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------- Buttons ---------------- */

export function PrimaryButton({
  loading,
  loadingLabel = "Signing in…",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      {...props}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-[0.9375rem] font-semibold text-primary-foreground shadow-[var(--shadow-cta)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-primary-deep active:translate-y-px active:shadow-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (
        <>
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground"
          />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function TextLink({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-sm text-[0.8125rem] font-semibold text-primary-deep underline-offset-4 transition-colors hover:text-primary hover:underline focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
    >
      {children}
    </button>
  );
}

/* ---------------- Feedback ---------------- */

export function AuthError({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="animate-rise flex gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-3.5"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold text-destructive">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-foreground/75">{children}</p>
      </div>
    </div>
  );
}

export function AuthSuccess({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="animate-rise flex gap-3 rounded-md border border-primary/25 bg-primary/5 p-3.5">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-deep" aria-hidden />
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold text-primary-deep">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-foreground/75">{children}</p>
      </div>
    </div>
  );
}

export function SecurityNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary-deep" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
