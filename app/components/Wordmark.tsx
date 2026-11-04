/**
 * The brand mark: "Worthmark" in the heading weight, then a teal full stop.
 * The only place the name is spelled out as a logo, so nav, footer and the
 * auth pages can't drift apart. Size and spacing come from the caller's class;
 * weight and colours from .wordmark in globals.css.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `wordmark ${className}` : "wordmark"}>
      Worthmark<span className="wordmark-stop">.</span>
    </span>
  );
}
