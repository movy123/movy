import type { ReactNode } from "react";

export function SectionHeader({
  kicker,
  title,
  description,
  aside
}: {
  kicker: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h2>{title}</h2>
        {description ? <p className="section-copy">{description}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  );
}
