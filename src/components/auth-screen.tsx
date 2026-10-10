import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Mode = "choose" | "password" | "magic";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ error: { message: string } | null }>, ok?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await fn();
    setBusy(false);
    if (err) setError(err.message);
    else if (ok) setMessage(ok);
  }

  const tryDemo = () =>
    run(async () => {
      const { error: err } = await supabase.auth.signInAnonymously();
      return { error: err };
    });

  const signIn = () =>
    run(async () => {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      return { error: err };
    });

  const signUp = () =>
    run(async () => {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      return { error: err };
    }, "Check your email to confirm the account, then sign in.");

  const magicLink = () =>
    run(async () => {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      return { error: err };
    }, "Check your email for the sign-in link.");

  return (
    <div className="mc-landing">
      <header className="mc-landing-top">
        <p className="mc-landing-mark">
          T-Minus <span>Mission Acquisition Acceleration</span>
        </p>
      </header>
      <main className="mc-landing-main">
        <h1>T-Minus turns acquisition time into mission readiness.</h1>
        <p className="mc-landing-sub">
          Procurement at the speed of mission. Every acquisition shows its days to award, what is
          holding it, and who owns the next step.
        </p>

        {mode === "choose" ? (
          <div className="mc-landing-actions">
            <button type="button" disabled={busy} onClick={tryDemo} className="mc-landing-primary">
              Try the demo
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className="mc-landing-secondary"
            >
              Sign in
            </button>
          </div>
        ) : (
          <form
            className="console-panel mt-8 max-w-[480px] space-y-4 rounded-xl border border-white/10 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "magic") void magicLink();
              else void signIn();
            }}
          >
            <div>
              <label htmlFor="auth-email" className="block text-[13px] text-chrome-muted">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-[15px] text-chrome-foreground"
              />
            </div>

            {mode === "password" ? (
              <div>
                <label htmlFor="auth-password" className="block text-[13px] text-chrome-muted">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-[15px] text-chrome-foreground"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-accent-cyan px-4 py-2 text-[15px] font-medium text-[color:var(--chrome)]"
              >
                {mode === "magic" ? "Email me a magic link" : "Sign in"}
              </button>
              {mode === "password" ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void signUp()}
                    className="rounded-lg border border-white/25 px-4 py-2 text-[15px] text-chrome-foreground hover:bg-white/10"
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("magic")}
                    className="text-[15px] text-accent-cyan underline"
                  >
                    Email me a magic link
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className="text-[15px] text-accent-cyan underline"
                >
                  Use a password
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-[15px] text-chrome-muted underline"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {error ? (
          <p role="alert" className="mt-6 text-[15px]" style={{ color: "#ff8f7f" }}>
            At risk: {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-6 text-[15px] text-chrome-muted">
            {message}
          </p>
        ) : null}
      </main>

      <LandingHorizon />

      <ul className="mc-landing-facts">
        <li>Enter the acquisition once. Every document, check and record reads from it.</li>
        <li>FAR and NASA FAR Supplement rules are checked as the work happens.</li>
        <li>Every action is logged for the contract file.</li>
      </ul>

      <footer className="mc-landing-foot">
        Prototype built for NASA by a NASA employee. Not an official NASA system.
      </footer>
    </div>
  );
}

// The launch sequence as a horizon: the same picture the acquisition file
// opens with. Decorative here, so it is hidden from assistive technology.
const HORIZON_STEPS = [
  "Intake",
  "Market research",
  "Solicitation",
  "Evaluation",
  "Reviews",
  "Award",
];
const H_W = 1200;
const H_H = 190;
const H_R = 2000;
const H_HALF = 520;
const H_APEX = 28;
const H_CY = H_APEX + H_R;
const H_MAX = Math.asin(H_HALF / H_R);
const H_LIMB = Math.asin((H_W / 2 + 60) / H_R);

function horizonPoint(i: number): { x: number; y: number } {
  const angle = -H_MAX + (2 * H_MAX * i) / (HORIZON_STEPS.length - 1);
  return { x: H_W / 2 + H_R * Math.sin(angle), y: H_CY - H_R * Math.cos(angle) };
}

function LandingHorizon() {
  const fix = (n: number) => Math.round(n * 10) / 10;
  const left = { x: H_W / 2 - H_R * Math.sin(H_LIMB), y: H_CY - H_R * Math.cos(H_LIMB) };
  const right = { x: H_W / 2 + H_R * Math.sin(H_LIMB), y: left.y };
  const limb = `M ${fix(left.x)} ${fix(left.y)} A ${H_R} ${H_R} 0 0 1 ${fix(right.x)} ${fix(right.y)}`;
  const first = horizonPoint(0);
  const last = horizonPoint(HORIZON_STEPS.length - 1);
  const lit = `M ${fix(first.x)} ${fix(first.y)} A ${H_R} ${H_R} 0 0 1 ${fix(last.x)} ${fix(last.y)}`;
  return (
    <div className="mc-landing-horizon" aria-hidden="true">
      <svg viewBox={`0 0 ${H_W} ${H_H}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="mc-landing-limb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17377e" />
            <stop offset="0.45" stopColor="#0e2152" />
            <stop offset="1" stopColor="#060d1f" />
          </linearGradient>
          <linearGradient id="mc-landing-lit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8fbbff" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <filter id="mc-landing-glow" x="-20%" y="-300%" width="140%" height="700%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <path
          d={`${limb} L ${fix(right.x)} ${H_H} L ${fix(left.x)} ${H_H} Z`}
          fill="url(#mc-landing-limb)"
        />
        <path d={limb} fill="none" stroke="#3a5596" strokeWidth="1.25" />
        <path
          d={lit}
          fill="none"
          stroke="#8fbbff"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.5"
          filter="url(#mc-landing-glow)"
        />
        <path
          className="mc-arc-lit"
          d={lit}
          pathLength={1}
          fill="none"
          stroke="url(#mc-landing-lit)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <ol>
        {HORIZON_STEPS.map((name, i) => {
          const at = horizonPoint(i);
          const isLast = i === HORIZON_STEPS.length - 1;
          return (
            <li
              key={name}
              className={isLast ? "is-launch" : undefined}
              style={{ left: `${fix((at.x / H_W) * 100)}%`, top: `${fix((at.y / H_H) * 100)}%` }}
            >
              <span className="mc-landing-dot" />
              <span className="mc-landing-step">{name}</span>
              {isLast ? <span className="mc-landing-launch">Launch</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
