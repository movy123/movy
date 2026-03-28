import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  body,
  tone = "default",
  extra
}: {
  label: string;
  value: ReactNode;
  body: string;
  tone?: "default" | "success" | "warning" | "danger";
  extra?: ReactNode;
}) {
  return (
    <article className={`panel stat-card stat-${tone}`}>
      <span className="card-label">{label}</span>
      <strong>{value}</strong>
      <p>{body}</p>
      {extra ? <div className="stat-extra">{extra}</div> : null}
    </article>
  );
}
