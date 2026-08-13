import type { ReactNode } from "react";
import { DecarbonisationVisual } from "./DecarbonisationVisual";
import { BrandHeader } from "./primitives";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---------- Left: decarbonisation story (desktop) ---------- */}
      <aside className="relative hidden overflow-hidden bg-carbon lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <DecarbonisationVisual />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-carbon/85 via-carbon/40 to-transparent" />

        <div className="relative">
          <BrandHeader inverted />
        </div>

        <div className="relative max-w-xl">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.28em] text-primary/90">
            Decarbonisation
          </p>
          <h1 className="mt-5 font-display text-[2.75rem] leading-[1.06] text-white xl:text-[3.35rem]">
            From measuring emissions
            <br />
            to meaningful reduction.
          </h1>
          <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-white/70">
            Understand your emissions. Build a clearer path to reduction.
          </p>
          <p className="mt-8 max-w-md border-l border-white/20 pl-4 text-[0.8125rem] leading-relaxed text-white/55">
            What gets measured can be understood. What is understood can be reduced.
          </p>
        </div>

        <div className="relative h-6" aria-hidden />
      </aside>

      {/* ---------- Right: authentication ---------- */}
      <main className="flex min-h-dvh flex-col px-5 pb-8 pt-6 sm:px-8 lg:min-h-0 lg:px-12 lg:py-12 xl:px-20">
        <header className="flex items-center justify-between lg:hidden">
          <BrandHeader />
        </header>

        {/* compact decarbonisation treatment for mobile / tablet */}
        <div className="relative mt-5 h-28 overflow-hidden rounded-lg bg-carbon sm:h-32 lg:hidden">
          <DecarbonisationVisual compact />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-carbon/85 via-carbon/40 to-transparent" />
          <div className="relative flex h-full max-w-[15rem] flex-col justify-center gap-1.5 px-4 sm:max-w-xs">
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-primary">
              Decarbonisation
            </p>
            <p className="font-display text-[1.0625rem] leading-[1.15] text-white sm:text-xl">
              From measuring emissions to meaningful reduction.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8 lg:py-0">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Deepwoods</span>
          <span>Decarb Portal</span>
        </footer>
      </main>
    </div>
  );
}
