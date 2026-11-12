/** "HỤI" wordmark shared with the landing: the dot under the U is the coin (lime ring on ink). Decorative; the link carries the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-center text-[1.4rem] leading-none font-black tracking-[-0.05em] ${className ?? ''}`}>
      H
      <span className="relative">
        U
        <i className="absolute bottom-[-5px] left-1/2 -ml-[3px] size-1.5 rounded-full bg-foreground shadow-[0_0_0_1.5px_var(--action)]" />
      </span>
      I
    </span>
  );
}
