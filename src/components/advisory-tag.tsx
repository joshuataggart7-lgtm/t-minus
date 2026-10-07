import { useId } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const ADVISORY_TEXT = "Advisory. Never holds the file or blocks a phase exit.";

/**
 * A small outlined "Advisory" pill for a panel heading, in place of the
 * repeated sentence. The full sentence is in the tooltip and is also tied to
 * the pill for screen readers.
 */
export function AdvisoryTag({ text = ADVISORY_TEXT }: { text?: string }) {
  const id = useId();
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-describedby={id}
            className="inline-flex shrink-0 items-center rounded-full border border-border px-2 text-[12px] leading-5 text-muted-foreground"
          >
            Advisory
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-popover text-popover-foreground">{text}</TooltipContent>
      </Tooltip>
      <span id={id} className="sr-only">
        {text}
      </span>
    </TooltipProvider>
  );
}
