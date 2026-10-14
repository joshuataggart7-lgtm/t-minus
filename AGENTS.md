<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Reuse `useOperationalDisplay` for cross-route read-only acquisition state so UI never exposes raw clock/phase fields without Launched-audit evidence.
- Resolve Sample 1 memorandum signatures through the shared sample helper after merging saved headers, so an older header cannot introduce a second contracting officer.
- Derive required-review pending counts from `pollBoard` via `pendingRequiredReviews`; show optional requested reviews separately so they never inflate required-review counts.
- Format receipts size standards with the shared `receiptsSizeStandard` helper using values read from the SBA table, so memorandum and form wording agrees without regulatory fallbacks.
