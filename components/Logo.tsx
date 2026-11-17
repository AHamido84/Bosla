/**
 * Human Compass mark — exact vector paths extracted from brand/brochure.pdf (page 27 header).
 * variant="color":   copper needle + emerald-700 body (default, light backgrounds)
 * variant="outline": 1px strokes (white body, copper needle) — the page-31 motif for dark sections
 */
const NEEDLE =
  "M72.316 24.34L78.137 37.688C74.258 35.508 70.375 35.508 66.492 37.688Z";
const BODY = [
  // upper arcs
  "M54.594 42.656C56.547 36.984 61.098 32.59 66.836 30.84C64.504 33.426 62.661 37.262 61.668 43.367C59.535 42.656 57.121 42.09 54.594 42.656Z",
  "M90.039 42.656C88.082 36.984 83.531 32.59 77.793 30.84C80.125 33.426 81.973 37.262 82.965 43.367C85.094 42.656 87.508 42.09 90.039 42.656Z",
  // leaves
  "M53.855 45.508C52.934 50.738 54.273 56.117 57.547 60.301C60.816 64.488 65.711 67.09 71.008 67.457C71.313 67.488 71.465 67.316 71.465 66.938L71.465 63.953C71.465 54.156 65.785 47.059 54.426 44.504C54.141 44.406 53.953 44.742 53.855 45.508Z",
  "M90.773 45.508C91.695 50.738 90.355 56.117 87.086 60.301C83.816 64.488 78.922 67.09 73.625 67.457C73.32 67.488 73.168 67.316 73.168 66.938L73.168 63.953C73.168 54.156 78.848 47.059 90.207 44.504C90.492 44.406 90.68 44.742 90.773 45.508Z",
  // head
  "M75.863 42.371C75.863 44.332 74.277 45.922 72.316 45.922C70.355 45.922 68.766 44.332 68.766 42.371C68.766 40.41 70.355 38.824 72.316 38.824C74.277 38.824 75.863 40.41 75.863 42.371Z",
];

interface Props {
  variant?: "color" | "outline";
  className?: string;
  title?: string;
}

export function Logo({ variant = "color", className, title }: Props) {
  const outline = variant === "outline";
  return (
    <svg
      viewBox="53.3 23.8 38 44.2"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {BODY.map((d) => (
        <path
          key={d}
          d={d}
          fill={outline ? "none" : "var(--color-emerald-700)"}
          stroke={outline ? "currentColor" : undefined}
          strokeWidth={outline ? 1 : undefined}
          vectorEffect={outline ? "non-scaling-stroke" : undefined}
        />
      ))}
      <path
        d={NEEDLE}
        fill={outline ? "none" : "var(--color-copper)"}
        stroke={outline ? "var(--color-copper)" : undefined}
        strokeWidth={outline ? 1 : undefined}
        vectorEffect={outline ? "non-scaling-stroke" : undefined}
      />
    </svg>
  );
}
