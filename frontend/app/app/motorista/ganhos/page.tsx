import { formatCurrency } from "../../../lib/dashboard";
import { AppShell } from "../../../ui/app-shell";
import { SectionHeader } from "../../../ui/section-header";

const navItems = [
  { href: "/app/motorista", label: "Painel" },
  { href: "/app/motorista/ganhos", label: "Ganhos" },
  { href: "/app/motorista/seguranca", label: "Seguranca" }
];

export default function DriverEarningsPage() {
  return (
    <AppShell
      role="motorista"
      currentPath="/app/motorista/ganhos"
      navItems={navItems}
      headerBadge="Ganhos"
    >
      <section className="panel stack-panel">
        <SectionHeader
          kicker="Financeiro"
          title="Ganhos precisam ser legiveis como ferramenta de trabalho."
          description="Essa area vai consolidar liquido, taxa, repasse previsto, desempenho por rota e visao temporal."
        />
        <div className="compact-grid">
          <article className="feature-card">
            <h3>Liquido hoje</h3>
            <p>{formatCurrency(426.2)}</p>
          </article>
          <article className="feature-card">
            <h3>Taxa plataforma</h3>
            <p>{formatCurrency(78.4)}</p>
          </article>
          <article className="feature-card">
            <h3>Repasse previsto</h3>
            <p>{formatCurrency(318.45)}</p>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
