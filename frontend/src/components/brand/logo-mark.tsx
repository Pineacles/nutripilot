import type { SVGProps } from "react";

// Arc N: two stems joined by a quarter arc (centre 232,32 / radius 200 in a 256 grid).
// Stems take the text colour, the arc takes the carbs plate ink. The arc runs under the
// stems so the joints cannot show a hairline seam. Sized in em so 1em equals the cap height
// of the wordmark when the parent aligns on the baseline.
export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="32 32 192 192"
      width="0.7em"
      height="0.7em"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        fill="var(--carbs)"
        d="M72 32 H80 A152 152 0 0 0 176 173.31 H184 V224 H176 A200 200 0 0 1 80 161.98 H72 Z"
      />
      <path fill="currentColor" d="M32 32 H80 V224 H32 Z M176 32 H224 V224 H176 Z" />
    </svg>
  );
}
