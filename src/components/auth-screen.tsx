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
    run(
      async () => {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        return { error: err };
      },
      "Check your email to confirm the account, then sign in.",
    );

  const magicLink = () =>
    run(
      async () => {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        return { error: err };
      },
      "Check your email for the sign-in link.",
    );

  return (
    <div className="chrome-surface min-h-screen text-chrome-foreground">
      <main className="mx-auto max-w-[560px] px-6 py-16">
        <span aria-hidden="true" className="mb-5 block h-[3px] w-12 rounded-sm bg-accent-cyan" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chrome-muted">
          Mission Acquisition Acceleration
        </p>
        <h1 className="mt-2 text-[34px] leading-[40px] font-semibold text-chrome-foreground">T-Minus</h1>
        <p className="mt-5 max-w-[70ch] text-[17px] leading-[26px] text-chrome-foreground">
          T-Minus turns acquisition time into mission readiness.
        </p>
        <p className="mt-2 max-w-[70ch] text-[15px] leading-[22px] text-chrome-muted">
          Procurement at the speed of mission.
        </p>

        {mode === "choose" ? (
          <div className="console-panel mt-8 flex flex-wrap gap-3 rounded-xl border border-white/10 p-5">
            <button
              type="button"
              onClick={() => setMode("password")}
              className="rounded-lg bg-accent-cyan px-4 py-2 text-[15px] font-medium text-[color:var(--chrome)]"
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={tryDemo}
              className="rounded-lg border border-white/25 px-4 py-2 text-[15px] text-chrome-foreground hover:bg-white/10"
            >
              Try the demo
            </button>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "magic") void magicLink();
              else void signIn();
            }}
          >
            <div>
              <label htmlFor="auth-email" className="block text-[13px] text-muted-foreground">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              />
            </div>

            {mode === "password" ? (
              <div>
                <label htmlFor="auth-password" className="block text-[13px] text-muted-foreground">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
              >
                {mode === "magic" ? "Email me a magic link" : "Sign in"}
              </button>
              {mode === "password" ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void signUp()}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-[15px]"
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("magic")}
                    className="text-[15px] text-primary underline"
                  >
                    Email me a magic link
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className="text-[15px] text-primary underline"
                >
                  Use a password
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-[15px] text-muted-foreground underline"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {error ? (
          <p role="alert" className="mt-6 text-[15px]" style={{ color: "var(--risk)" }}>
            At risk: {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-6 text-[15px] text-muted-foreground">
            {message}
          </p>
        ) : null}

        <p className="mt-12 text-[13px] text-muted-foreground">
          Prototype. Not an official NASA system.
        </p>
      </main>
    </div>
  );
}
