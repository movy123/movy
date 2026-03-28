import { formatCompactNumber, formatCurrency, getDashboardData } from "../../lib/dashboard";
import { AppShell } from "../../ui/app-shell";
import { SectionHeader } from "../../ui/section-header";
import { StatCard } from "../../ui/stat-card";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/app/admin", label: "Dashboard" },
  { href: "/app/admin/live", label: "Live Ops" },
  { href: "/app/admin/incidentes", label: "Incidentes" }
];

export default async function AdminPage() {
  const { overview, payments, rides } = await getDashboardData();
  const activeRides = rides.filter((ride) => ["MATCHED", "ACCEPTED", "IN_PROGRESS"].includes(ride.status));

  return (
    <AppShell
      role="admin"
      currentPath="/app/admin"
      navItems={navItems}
      headerBadge="Control tower"
    >
      <section className="page-grid">
        <div className="page-hero panel">
          <SectionHeader
            kicker="Admin"
            title="A operacao precisa ser lida em menos de 10 segundos."
            description="KPIs, risco, liquidez e incidentes devem estar na primeira dobra com prioridade visual coerente e rastreabilidade."
            aside={
              <span className={`risk-badge ${overview.security.openSosAlerts > 0 ? "risk-high" : "risk-low"}`}>
                {overview.security.openSosAlerts > 0 ? "Incidentes em aberto" : "Operacao estavel"}
              </span>
            }
          />
        </div>

        <div className="compact-grid">
          <StatCard
            label="Base ativa"
            value={formatCompactNumber(overview.kpis.totalUsers)}
            body="Leitura executiva rapida da plataforma em operacao."
          />
          <StatCard
            label="Receita plataforma"
            value={formatCurrency(payments.platformRevenue)}
            body="Indicador financeiro direto para operar taxa, campanha e liquidez."
            tone="success"
          />
          <StatCard
            label="Corridas monitoradas"
            value={activeRides.length}
            body="Viagens em pontos criticos da jornada e sob visibilidade operacional."
            tone={overview.security.openSosAlerts > 0 ? "warning" : "default"}
          />
          <StatCard
            label="SOS abertos"
            value={overview.security.openSosAlerts}
            body="Fila prioritaria para resposta, auditoria e bloqueio preventivo."
            tone={overview.security.openSosAlerts > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Sinais antifraude"
            value={overview.security.openFraudSignals}
            body="Eventos de risco que precisam de triagem contextual e politicas de resposta."
            tone={overview.security.openFraudSignals > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Usuarios com MFA"
            value={overview.operations.mfaProtectedUsers}
            body="Base protegida por segundo fator para contas sensiveis e de maior risco."
          />
        </div>

        <section className="panel stack-panel">
          <SectionHeader
            kicker="Camadas operacionais"
            title="O que a UI admin precisa sustentar"
            description="Cada modulo deve ser orientado a decisao e acao, nao a ornamentacao."
          />
          <div className="feature-list">
            <article className="feature-card">
              <h3>Live operations</h3>
              <p>Mapa, corridas, filtros, status, SLA e fila de atencao imediata.</p>
            </article>
            <article className="feature-card">
              <h3>Incidentes e antifraude</h3>
              <p>Trilha da viagem, evidencias, severidade, protocolo e acoes auditadas.</p>
            </article>
            <article className="feature-card">
              <h3>Pagamentos e reputacao</h3>
              <p>Repasses, chargebacks, disputas, score e qualidade operacional.</p>
            </article>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
