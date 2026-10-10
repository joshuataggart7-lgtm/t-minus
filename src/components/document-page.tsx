import { AGENCY_LINE, CUI_BANNER, INSIGNIA_URL, type MemoDoc } from "@/lib/nf1858";
import { EMPTY_FIELD, type exportBlocks } from "@/lib/template-engine";

/**
 * The document read as a page. It shows what Export PDF writes, built from the
 * same data in the same order: the NF 1858 memorandum when the document is
 * issued on that letterhead, the generic print blocks otherwise. Display only.
 * Editing stays in the Fields view, and the export remains the file of record
 * layout (some documents export into an official Word master).
 */

type PrintBlocks = ReturnType<typeof exportBlocks>;

export type DocumentView = "page" | "fields";

/** The Page / Fields switch above a document. */
export function DocumentViewSwitch({
  view,
  onChange,
  note,
}: {
  view: DocumentView;
  onChange: (next: DocumentView) => void;
  note?: string | null;
}) {
  return (
    <div className="mc-docview no-print">
      <div className="mc-docview-seg" role="group" aria-label="How to read this document">
        {(["page", "fields"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            className={view === v ? "is-on" : undefined}
            onClick={() => onChange(v)}
          >
            {v === "page" ? "Page" : "Fields"}
          </button>
        ))}
      </div>
      {note ? <p className="mc-docview-note">{note}</p> : null}
    </div>
  );
}

function Labelled({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="mc-page-row">
      <dt>{label}</dt>
      <dd>
        {values.map((v, i) => (
          <span key={i}>{v}</span>
        ))}
      </dd>
    </div>
  );
}

function MemoPage({ memo }: { memo: MemoDoc }) {
  const h = memo.header;
  return (
    <>
      {h.cui ? <p className="mc-page-cui">{CUI_BANNER}</p> : null}
      <header className="mc-page-letterhead">
        <div>
          <p className="mc-page-agency">{AGENCY_LINE}</p>
          <p>{h.centerName}</p>
          <p>{h.centerAddress}</p>
        </div>
        <img src={INSIGNIA_URL} alt="NASA insignia" width={78} height={72} />
      </header>
      <p className="mc-page-date">{h.date}</p>
      <dl className="mc-page-head">
        <Labelled label="Reply to Attn of" values={[h.replyTo || EMPTY_FIELD]} />
        <Labelled label="To" values={[h.to]} />
        <Labelled label="Thru" values={h.thru} />
        <Labelled label="From" values={[h.from]} />
        <Labelled label="Subject" values={[h.subject]} />
        <Labelled label="Ref" values={h.ref} />
      </dl>
      {h.salutation ? <p className="mc-page-para">{h.salutation}</p> : null}
      <ol className="mc-page-body">
        {memo.paragraphs.map((p, i) => (
          <li key={i}>
            <p>{p.text}</p>
            {p.lines.length ? (
              <ul>
                {p.lines.map((line, k) => (
                  <li key={k}>{line}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="mc-page-sign">
        <span className="mc-page-signline" aria-hidden="true" />
        <p>{h.signatureName}</p>
        <p>{h.signatureTitle}</p>
        {memo.signedOn ? <p>Date: {memo.signedOn}</p> : null}
      </div>
      {h.concurrence.length ? (
        <div className="mc-page-after">
          <p className="mc-page-strong">Concurrence:</p>
          {h.concurrence.map((c, i) => (
            <div key={i} className="mc-page-sign is-concur">
              <span className="mc-page-signline" aria-hidden="true" />
              <p>{[c.name, c.title].filter(Boolean).join(", ")}</p>
            </div>
          ))}
        </div>
      ) : null}
      {h.enclosures.length === 1 ? (
        <p className="mc-page-after">Enclosure: {h.enclosures[0]}</p>
      ) : null}
      {h.enclosures.length > 1 ? (
        <div className="mc-page-after">
          <p className="mc-page-strong">Enclosures:</p>
          <ol className="mc-page-list is-numbered">
            {h.enclosures.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {h.distribution.length ? (
        <div className="mc-page-after">
          <p className="mc-page-strong">Distribution:</p>
          <ul className="mc-page-list">
            {h.distribution.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {h.cc.length ? (
        <div className="mc-page-after">
          <p className="mc-page-strong">cc:</p>
          <ul className="mc-page-list">
            {h.cc.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {h.cui ? <p className="mc-page-cui is-foot">{CUI_BANNER}</p> : null}
    </>
  );
}

function BlocksPage({ blocks }: { blocks: PrintBlocks }) {
  return (
    <>
      {blocks.map((b, i) => (
        <section key={i} className="mc-page-block">
          {b.heading ? <h3>{b.heading}</h3> : null}
          {b.lines.map((line, k) => (
            <p
              key={k}
              className={
                [b.center ? "is-center" : "", b.bold ? "is-bold" : ""].filter(Boolean).join(" ") ||
                undefined
              }
            >
              {line}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}

export function DocumentSheet({
  memo,
  blocks,
  headerLine,
  title,
}: {
  memo?: MemoDoc | null;
  blocks?: PrintBlocks | null;
  headerLine: string;
  title: string;
}) {
  if (!memo && !blocks?.length) return null;
  return (
    <article className="mc-page" aria-label={`${title}, read as a page`}>
      {memo ? <MemoPage memo={memo} /> : <BlocksPage blocks={blocks ?? []} />}
      <footer className="mc-page-foot">
        <span>{headerLine}</span>
        <span>Prototype, synthetic data</span>
      </footer>
    </article>
  );
}
