import { cn } from '@/lib/cn';

/** RadarJob mark: concentric rings with a sweep. `animated` is used once, in the hero. */
export function RadarMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#13213c" />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="#6f9be0"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <circle
        cx="16"
        cy="16"
        r="5.5"
        fill="none"
        stroke="#6f9be0"
        strokeWidth="1.5"
        opacity="0.8"
      />
      <g className={animated ? 'rj-sweep' : undefined}>
        <path d="M16 16 L16 5 A11 11 0 0 1 25.5 10.5 Z" fill="#3b7ddd" opacity="0.55" />
        <line
          x1="16"
          y1="16"
          x2="16"
          y2="5"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
      <circle cx="21.5" cy="11.5" r="1.8" fill="#ffffff" />
    </svg>
  );
}
