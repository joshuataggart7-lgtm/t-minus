// Buying guides / Strategic Acquisition Guidance (non-binding practice).
//
// Nothing here is invented. The only official public practice URL hard-coded
// anywhere in T-Minus is the RFO hub in src/lib/pcd-adoption.ts. No NASA OP
// buying guide or GSA Strategic Acquisition Guidance URL is loaded, and none
// is fabricated here: the panel says so plainly.

import { RFO_SOURCE_URL } from "@/lib/pcd-adoption";

const NON_BINDING = "Non-binding practice — not FAR / not NFS.";

export function PracticeLinksPanel() {
  return (
    <section aria-label="Buying guides and practice guidance" className="mt-6 max-w-[80ch] border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[18px] font-medium leading-[24px]">Buying guides &amp; practice guidance</h3>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      <ul className="mt-3 list-none space-y-3 text-[13px] leading-[18px]">
        <li className="border-t border-border pt-2">
          <p className="font-medium">FAR overhaul (RFO) hub</p>
          <p className="text-muted-foreground">
            The official RFO source and how-to hub. It is not FAR text, and T-Minus does not carry the FAR body.
          </p>
          <a
            href={RFO_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Official RFO source at acquisition.gov/far-overhaul
          </a>
          <p className="text-muted-foreground">{NON_BINDING}</p>
        </li>
        <li className="border-t border-border pt-2">
          <p className="font-medium">NASA OP buying guides</p>
          <p className="text-muted-foreground">
            Not loaded. No official NASA buying-guide link is recorded in this prototype, so none is shown. {NON_BINDING}
          </p>
        </li>
        <li className="border-t border-border pt-2">
          <p className="font-medium">GSA Strategic Acquisition Guidance</p>
          <p className="text-muted-foreground">
            Not loaded. No official GSA guidance link is recorded in this prototype, so none is shown. {NON_BINDING}
          </p>
        </li>
      </ul>

      <p className="mt-2 border-t border-border pt-2 text-[13px] leading-[18px] text-muted-foreground">
        The reference rows T-Minus holds carry no official links today, and links are never invented. Where the NFS
        Companion Guide is named anywhere in T-Minus it is process guidance only, never binding.
      </p>
    </section>
  );
}
