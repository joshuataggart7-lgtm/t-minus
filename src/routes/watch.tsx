import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { runWatchFetch } from "@/lib/watch.functions";
import {
  itemsFromRefs,
  itemsFromWatchRows,
  loadRegRefs,
  loadWatchRows,
  partTags,
  sortNewestFirst,
  WATCH_SOURCES,
  type FeedItem,
  type WatchSource,
} from "@/lib/watch";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "Watch — T-Minus" },
      {
        name: "description",
        content: "GAO bid protest decisions, Federal Register documents, class deviations, and OP notices.",
      },
      { property: "og:title", content: "Watch — T-Minus" },
      {
        property: "og:description",
        content: "GAO decisions, Federal Register documents, class deviations, and OP notices, newest first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tag?: string } =>
    typeof search['tag'] === "string" ? { tag: search['tag'] as string } : {},
  component: WatchPage,
});

function useFeed() {
  const { authState } = useRole();
  return useQuery({
    queryKey: ["watch-feed"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [rows, refs, audits] = await Promise.all([
        loadWatchRows(),
        loadRegRefs(),
        supabase.from("audit_log").select("action,reason").in("action", ["GAO fetch", "Federal Register fetch"]),
      ]);
      const live = new Set((audits.data ?? []).filter((row) => !/provider error|could not be reached|queries failed/i.test(row.reason ?? "")).map((row) => row.action?.replace(" fetch", "")));
      return { items: sortNewestFirst([...itemsFromWatchRows(rows), ...itemsFromRefs(refs)]), live };
    },
  });
}

function WatchPage() {
  const { hasRole, hasAnyRole, user } = useRole();
  const queryClient = useQueryClient();
  const q = useFeed();
  const [source, setSource] = useState<"all" | WatchSource>("all");
  const initialTag = Route.useSearch().tag;
  const [tag, setTag] = useState(initialTag ?? "all");
  const [runNote, setRunNote] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const canPost = hasRole("hq");
  const canFetch = hasAnyRole(["hq", "specialist"]);

  const items = q.data?.items ?? [];
  const tags = useMemo(
    () => [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const shown = items.filter(
    (i) => (source === "all" || i.source === source) && (tag === "all" || i.tags.includes(tag)),
  );

  const fetchFeeds = useMutation({
    mutationFn: (feed: "gao" | "federal-register" | "both") => runWatchFetch({ data: { feed } }),
    onSuccess: async (results) => {
      setRunError(null);
      setRunNote(
        results
          .map(
            (r) =>
              `${r.source}: ${r.inserted} new of ${r.fetched} retrieved. ${r.note}${
                r.providerError ? ` ${r.providerError}` : ""
              }`,
          )
          .join(" "),
      );
      await queryClient.invalidateQueries({ queryKey: ["watch-feed"] });
    },
    onError: (error: unknown) => {
      setRunNote(null);
      setRunError(
        error instanceof Error
          ? `${error.message} Try the fetch again in a moment.`
          : "The fetch did not run. Try again in a moment.",
      );
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Watch"
        lead="Protest decisions, rule changes, and notices worth watching. Newest first."
      />

      {canFetch ? (
        <section aria-label="Run a fetch" className="mb-8">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
              disabled={fetchFeeds.isPending}
              onClick={() => fetchFeeds.mutate("gao")}
            >
              Fetch GAO decisions
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
              disabled={fetchFeeds.isPending}
              onClick={() => fetchFeeds.mutate("federal-register")}
            >
              Fetch Federal Register
            </button>
          </div>
          {fetchFeeds.isPending ? <LoadingNote what="the fetch" /> : null}
          {runNote ? (
            <p className="mt-3 max-w-[80ch] text-[13px] text-muted-foreground">{runNote}</p>
          ) : null}
          {runError ? <ErrorNote message={runError} /> : null}
        </section>
      ) : null}

      {canPost ? <OpNoticeForm actor={user.name} onPosted={() => queryClient.invalidateQueries({ queryKey: ["watch-feed"] })} /> : null}

      <section aria-label="Filters" className="mb-6 flex flex-wrap gap-6">
        <div>
          <label htmlFor="watch-source" className="block text-[13px] text-muted-foreground">
            Source
          </label>
          <select
            id="watch-source"
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={source}
            onChange={(e) => setSource(e.target.value as "all" | WatchSource)}
          >
            <option value="all">All sources</option>
            {WATCH_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="watch-tag" className="block text-[13px] text-muted-foreground">
            Tag
          </label>
          <select
            id="watch-tag"
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="all">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </section>

      {q.isLoading ? <LoadingNote what="the feeds" /> : null}
      {q.error ? (
        <ErrorNote message="The feeds did not load. Reload the page, and run a fetch if the list stays empty." />
      ) : null}

      {!q.isLoading ? (
        <div className="mb-5 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
          {(["GAO", "Federal Register"] as const).map((feed) => (
            <span key={feed}>{feed}: {q.data?.live.has(feed) ? "Live feed available" : "Live feed not yet run"}</span>
          ))}
        </div>
      ) : null}

      {!q.isLoading && !q.error && shown.length === 0 ? (
        <EmptyState
          sentence="No items match these filters yet."
          action={
            canFetch ? (
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
                onClick={() => {
                  setSource("all");
                  setTag("all");
                  fetchFeeds.mutate("both");
                }}
              >
                Fetch the feeds now
              </button>
            ) : undefined
          }
        />
      ) : null}

      <ul className="max-w-[80ch] divide-y divide-border border-t border-border">
        {shown.map((item) => (
          <FeedRow key={item.id} item={item} />
        ))}
      </ul>
    </AppShell>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  return (
    <li className="py-4">
      <p className="text-[13px] text-muted-foreground" data-numeric>
        {item.source} · {item.sample ? "Sample · " : ""}{item.date ?? "Date not published"} · {item.outcomeOrType}
      </p>
      <p className="mt-1 text-[15px] leading-[22px] text-foreground">{item.title}</p>
      {item.summary ? (
        <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{item.summary}</p>
      ) : null}
      <p className="mt-1 text-[13px]">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
            Open the source
          </a>
        ) : (
          <span className="text-muted-foreground">No link published</span>
        )}
        {item.tags.length ? <span className="text-muted-foreground"> · {item.tags.join(" · ")}</span> : null}
      </p>
    </li>
  );
}

function OpNoticeForm({ actor, onPosted }: { actor: string; onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const post = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Enter a title before posting the notice.");
      return;
    }
    const row = {
      source: "OP notice",
      external_id: `OP-${Date.now()}`,
      title: title.trim(),
      decided_or_published_date: date || null,
      outcome_or_type: "OP notice",
      agency: "NASA Office of Procurement",
      url: url.trim() || null,
      summary: summary.trim() || null,
      fetched_at: new Date().toISOString(),
      tags: ["OP notice", ...partTags(title, summary)],
    };
    const { error: insertError } = await supabase.from("watch_items").insert(row);
    if (insertError) {
      setError(`${insertError.message} Check the entry and post it again.`);
      return;
    }
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor,
      action: "Watch item posted",
      field: "watch_items",
      old_value: null,
      new_value: row.title,
      reason: "OP notice entered by HQ",
      logged_at: new Date().toISOString(),
    });
    setTitle("");
    setSummary("");
    setUrl("");
    setSaved(true);
    onPosted();
  };

  return (
    <section aria-label="Post an OP notice" className="mb-8 max-w-[80ch]">
      <button
        type="button"
        className="rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close the OP notice form" : "Post an OP notice"}
      </button>
      {open ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <div>
            <label htmlFor="op-title" className="block text-[13px] text-muted-foreground">
              Title
            </label>
            <input
              id="op-title"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="op-date" className="block text-[13px] text-muted-foreground">
              Date
            </label>
            <input
              id="op-date"
              type="date"
              className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="op-summary" className="block text-[13px] text-muted-foreground">
              One-line summary
            </label>
            <input
              id="op-summary"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="op-url" className="block text-[13px] text-muted-foreground">
              Link
            </label>
            <input
              id="op-url"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          {error ? <ErrorNote message={error} /> : null}
          {saved ? <p className="text-[13px] text-muted-foreground">The notice is posted.</p> : null}
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-[15px] text-primary">
            Post the notice
          </button>
        </form>
      ) : null}
    </section>
  );
}
