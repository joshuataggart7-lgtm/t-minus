import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppShell,
  EmptyState,
  ErrorNote,
  LoadingNote,
  PageHeader,
  StatusMark,
} from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { SEEDED_USERS, type RoleId } from "@/lib/roles";
import {
  acknowledge,
  currentUserId,
  inAudience,
  isCurrent,
  loadAcks,
  loadAnnouncements,
  severityColor,
  severityWord,
  SEVERITIES,
  type Ack,
  type Announcement,
} from "@/lib/announcements";

const ROLE_OPTIONS: { id: RoleId; label: string }[] = SEEDED_USERS.map((u) => ({
  id: u.role,
  label: u.title,
}));

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function AnnouncementsPage() {
  const { role, roles, hasRole, user, authState } = useRole();
  const [items, setItems] = useState<Announcement[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [people, setPeople] = useState<{ user_id: string; center_code: string | null }[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [all, a, me, users] = await Promise.all([
        loadAnnouncements(),
        loadAcks(),
        currentUserId(),
        supabase.from("users").select("user_id,center_code"),
      ]);
      setItems(all);
      setAcks(a);
      setUid(me);
      setPeople((users.data ?? []) as { user_id: string; center_code: string | null }[]);
      setState("ready");
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} Reload the page, or open Seed status to confirm the data loaded.`
          : "Announcements did not load. Reload the page.",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (authState !== "signed-in") return;
    void refresh();
  }, [authState, role, refresh]);

  const centerOf = useMemo(
    () => new Map(people.map((p) => [p.user_id, p.center_code ?? "Unknown"])),
    [people],
  );

  const current = items.filter((a) => isCurrent(a));
  const past = items.filter((a) => !isCurrent(a));

  const onAck = async (a: Announcement) => {
    try {
      await acknowledge(a, user.name);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The acknowledgment did not save. Try again.");
    }
  };

  const Row = ({ a }: { a: Announcement }) => {
    const mine = acks.some((k) => k.announcement_id === a.announcement_id && k.user_id === uid);
    const forMe = inAudience(a, roles, user.center_code);
    const byCenter = new Map<string, number>();
    for (const k of acks.filter((k) => k.announcement_id === a.announcement_id)) {
      const c = centerOf.get(k.user_id) ?? "Unknown";
      byCenter.set(c, (byCenter.get(c) ?? 0) + 1);
    }
    return (
      <article className="border-t border-border py-6">
        <StatusMark color={severityColor(a.severity)}>{severityWord(a.severity)}</StatusMark>
        <h3 className="mt-2 text-[18px] leading-6 font-medium text-foreground">{a.title}</h3>
        {a.body ? <p className="mt-2 max-w-[80ch] text-muted-foreground">{a.body}</p> : null}
        <p className="mt-2 text-[13px] tabular-nums text-muted-foreground">
          Posted {fmt(a.posted_at)} by {a.posted_by ?? "HQ"} · Effective {fmt(a.effective_from)}
          {a.effective_until ? ` until ${fmt(a.effective_until)}` : ""} · Audience{" "}
          {(a.audience_roles ?? []).length ? (a.audience_roles ?? []).join(", ") : "everyone"} ·{" "}
          {(a.audience_centers ?? []).length ? (a.audience_centers ?? []).join(", ") : "all Centers"}
        </p>
        {a.link ? (
          <a href={a.link} className="mt-2 inline-block text-primary underline underline-offset-2">
            Open the notice
          </a>
        ) : null}
        {a.requires_acknowledgment && forMe ? (
          <div className="mt-3">
            {mine ? (
              <p className="text-[13px] text-muted-foreground">You acknowledged this.</p>
            ) : (
              <button
                type="button"
                onClick={() => void onAck(a)}
                className="rounded-lg border-2 border-border px-3 py-2 text-[13px] text-foreground hover:border-primary"
              >
                Acknowledge
              </button>
            )}
          </div>
        ) : null}
        {hasRole("hq") && a.requires_acknowledgment ? (
          <div className="mt-4 max-w-[520px] border border-border">
            <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <caption className="border-b border-border px-3 py-2 text-left text-muted-foreground">
                Acknowledgments by Center: {acks.filter((k) => k.announcement_id === a.announcement_id).length}{" "}
                in total
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Center</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Acknowledged</th>
                </tr>
              </thead>
              <tbody>
                {byCenter.size === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground" colSpan={2}>
                      No acknowledgments yet.
                    </td>
                  </tr>
                ) : (
                  [...byCenter.entries()].map(([c, n]) => (
                    <tr key={c} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">{c}</td>
                      <td className="px-3 py-2 tabular-nums">{n}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <AppShell>
      <PageHeader title="Announcements" lead="Notices posted by HQ, with the action each one asks for." />

      {hasRole("hq") ? <PostForm actor={user.name} onPosted={refresh} /> : null}

      {state === "loading" ? <LoadingNote what="announcements" /> : null}
      {state === "error" && error ? <ErrorNote message={error} /> : null}

      {state === "ready" ? (
        <>
          <section className="mt-10">
            <h2 className="section-title">Current</h2>
            {current.length === 0 ? (
              <div className="mt-4">
                <EmptyState sentence="Nothing is posted right now." />
              </div>
            ) : (
              current.map((a) => <Row key={a.announcement_id} a={a} />)
            )}
          </section>
          <section className="mt-10">
            <h2 className="section-title">Past</h2>
            {past.length === 0 ? (
              <div className="mt-4">
                <EmptyState sentence="No announcement has expired yet." />
              </div>
            ) : (
              past.map((a) => <Row key={a.announcement_id} a={a} />)
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function PostForm({ actor, onPosted }: { actor: string; onPosted: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<string>("notice");
  const [roles, setRoles] = useState<RoleId[]>([]);
  const [centers, setCenters] = useState<string>("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState("");
  const [link, setLink] = useState("");
  const [ack, setAck] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setMsg("Give the announcement a title, then post it.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const posted_at = new Date().toISOString();
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim() || null,
      severity,
      audience_roles: roles.length ? roles : null,
      audience_centers: centers.trim() ? centers.split(",").map((c) => c.trim()) : null,
      effective_from: from ? new Date(`${from}T00:00:00`).toISOString() : posted_at,
      effective_until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
      link: link.trim() || null,
      requires_acknowledgment: ack,
      posted_by: actor,
      posted_at,
    });
    if (error) {
      setMsg(`${error.message} Check that you are signed in as HQ, then post again.`);
      setBusy(false);
      return;
    }
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor,
      action: "Announcement posted",
      field: "announcement",
      old_value: null,
      new_value: title.trim(),
      reason: severity,
      logged_at: posted_at,
    });
    setTitle("");
    setBody("");
    setLink("");
    setMsg("Posted.");
    setBusy(false);
    await onPosted();
  };

  const field = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px]";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3 py-2 text-[14px] text-primary hover:border-primary"
      >
        Post an announcement
      </button>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-[720px] border border-border p-6">
      <h2 className="section-title">Post an announcement</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="a-title" className="text-[13px] text-muted-foreground">Title</label>
          <input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="a-body" className="text-[13px] text-muted-foreground">Body</label>
          <textarea id="a-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="a-sev" className="text-[13px] text-muted-foreground">Severity</label>
          <select id="a-sev" value={severity} onChange={(e) => setSeverity(e.target.value)} className={field}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{severityWord(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-centers" className="text-[13px] text-muted-foreground">
            Centers, comma separated (blank means all)
          </label>
          <input id="a-centers" value={centers} onChange={(e) => setCenters(e.target.value)} className={field} />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-[13px] text-muted-foreground">Audience by role (none selected means everyone)</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {ROLE_OPTIONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={roles.includes(r.id)}
                  onChange={(e) =>
                    setRoles((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id)))
                  }
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="a-from" className="text-[13px] text-muted-foreground">Effective from</label>
          <input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="a-until" className="text-[13px] text-muted-foreground">Effective until</label>
          <input id="a-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="a-link" className="text-[13px] text-muted-foreground">Link, optional</label>
          <input id="a-link" value={link} onChange={(e) => setLink(e.target.value)} className={field} />
        </div>
        <label className="flex items-center gap-2 text-[14px] sm:col-span-2">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          Acknowledgment required
        </label>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border-2 border-border px-4 py-2 text-[14px] text-foreground hover:border-primary"
        >
          {busy ? "Posting" : "Post"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[14px] text-muted-foreground">
          Close
        </button>
        {msg ? <p role="status" className="text-[13px] text-muted-foreground">{msg}</p> : null}
      </div>
    </form>
  );
}

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — T-Minus" },
      { name: "description", content: "Notices posted by HQ, with the action each one asks for." },
      { property: "og:title", content: "Announcements — T-Minus" },
      {
        property: "og:description",
        content: "Notices posted by HQ, with the action each one asks for.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnnouncementsPage,
});
