import type { ElementType } from "react";

/**
 * Renders "احجزوا **اجتماعًا تعريفيًا**" with the **…** part in copper.
 * `tone="dark"` is for headlines on ink backgrounds.
 */
export function Accent({
  text,
  as: Tag = "span",
  className,
  id,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  id?: string;
}) {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return (
    <Tag className={className} id={id}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-copper">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </Tag>
  );
}
