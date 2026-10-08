import { useRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useScrollFade } from "@/lib/use-scroll-fade";

/** A horizontal strip that fades the edge with more to scroll (see .mc-scroll-fade). */
export function FadeStrip({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollFade(ref);
  return (
    <div ref={ref} data-scroll-region="" className={cn(className, "mc-scroll-fade")} {...props}>
      {children}
    </div>
  );
}
