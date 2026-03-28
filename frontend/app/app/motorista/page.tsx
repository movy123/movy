import { formatCurrency } from "../../lib/dashboard";
import { AppShell } from "../../ui/app-shell";
import { SectionHeader } from "../../ui/section-header";
import { StatCard } from "../../ui/stat-card";
import { DriverOperations } from "./driver-operations";

const navItems = [
  { href: "/app/motorista", label: "Painel" },
  { href: "/app/motorista/ganhos", label: "Ganhos" },
  { href: "/app/motorista/seguranca", label: "Seguranca" }
];

export default function DriverPage() {
  return (
    <AppShell
      role="motorista"
      currentPath="/app/motorista"
      navItems={navItems}
      headerBadge="Modo empresario"
    >
      <section className="page-grid">
        <div className="page-hero panel">
          <SectionHeader
            kicker="Motorista"
            title="O motorista precisa sentir controle, nao dependencia."
            description="A MOVY deve mostrar ganho liquido, risco, distancia ate pickup, filtros operacionais e status online/offline como ferramentas de trabalho."
            aside={<span className="status-pill live">Online agora</span>}
          />
          <div className="driver-offer-card">
            <span className="card-label">Exemplo de oferta forte</span>
            <div className="offer-grid">
              <div>
                <span className="metric-mini">Ganho liquido</span>
                <strong>{formatCurrency(24.7)}</strong>
              </div>
              <div>
                <span className="metric-mini">Pickup</span>
                <strong>4 min</strong>
              </div>
              <div>
                <span className="metric-mini">Risco</span>
                <strong>Baixo</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="compact-grid">
          <StatCard
            label="Receita do dia"
            value={formatCurrency(426.2)}
            body="Valor consolidado com leitura simples do liquido apos taxa."
            tone="success"
          />
          <StatCard
            label="Meta diaria"
            value="78%"
            body="Indicador rapido para apoiar tomada de decisao sem abrir relatorios."
          />
          <StatCard
            label="Repasse previsto"
            value={formatCurrency(318.45)}
            body="Previsao financeira clara para reduzir ansiedade e aumentar confianca."
          />
        </div>

        <section className="panel stack-panel">
          <SectionHeader
            kicker="Ferramentas"
            title="Modo empresario em primeira classe"
            description="O frontend do motorista precisa operar como cockpit de negocio."
          />
          <div className="feature-list">
            <article className="feature-card">
              <h3>Painel diario</h3>
              <p>Status online/offline, mapa operacional, metas, filtros e oportunidades.</p>
            </article>
            <article className="feature-card">
              <h3>Carteira e ganhos</h3>
              <p>Liquido, taxa, extrato, saque e previsao de recebiveis sem opacidade.</p>
            </article>
            <article className="feature-card">
              <h3>Seguranca operacional</h3>
              <p>PIN, incidentes, reputacao, score de risco e suporte durante a corrida.</p>
            </article>
          </div>
        </section>

        <DriverOperations />
      </section>
    </AppShell>
  );
}
