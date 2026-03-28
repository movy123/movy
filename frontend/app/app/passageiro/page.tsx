import { formatCurrency } from "../../lib/dashboard";
import { AppShell } from "../../ui/app-shell";
import { SectionHeader } from "../../ui/section-header";
import { StatCard } from "../../ui/stat-card";

const navItems = [
  { href: "/app/passageiro", label: "Inicio" },
  { href: "/app/passageiro/estimativa", label: "Estimativa" },
  { href: "/app/passageiro/seguranca", label: "Seguranca" }
];

const steps = [
  "Defina origem e destino com validacao curta e legivel.",
  "Compare tempo, preco e nivel de protecao antes de confirmar.",
  "Acompanhe a viagem com PIN, rota e safety center sempre ao alcance."
];

export default function PassengerPage() {
  return (
    <AppShell
      role="passageiro"
      currentPath="/app/passageiro"
      navItems={navItems}
      headerBadge="Jornada ativa"
    >
      <section className="page-grid">
        <div className="page-hero panel">
          <SectionHeader
            kicker="Passageiro"
            title="Toda decisao critica da viagem precisa estar clara em segundos."
            description="A interface do passageiro prioriza origem, destino, preco explicavel, status da corrida e recursos de seguranca sem esconder a proxima acao."
            aside={<span className="status-pill live">Protecoes ativas</span>}
          />
          <div className="timeline-card">
            <span className="card-label">Fluxo ideal</span>
            <ol className="ordered-list">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="compact-grid">
          <StatCard
            label="Preco previsto"
            value={formatCurrency(28.4)}
            body="Valor mostrado com breakdown, sem esconder demanda, taxa e tempo."
            tone="success"
          />
          <StatCard
            label="Tempo ate embarque"
            value="6 min"
            body="ETA sempre visivel na etapa de decisao e enquanto o motorista se aproxima."
          />
          <StatCard
            label="Confianca da viagem"
            value="Alta"
            body="PIN de embarque, sharing e score preventivo apresentados antes da corrida."
          />
        </div>

        <section className="panel stack-panel">
          <SectionHeader
            kicker="Telas prioritarias"
            title="Base de experiencia do passageiro"
            description="Estas telas devem ser as proximas a ganhar implementacao completa."
          />
          <div className="feature-list">
            <article className="feature-card">
              <h3>Home com mapa e CTA forte</h3>
              <p>Origem, destino, favoritos, CTA de nova viagem e estado da ultima corrida.</p>
            </article>
            <article className="feature-card">
              <h3>Estimativa explicavel</h3>
              <p>Preco, ETA, servico, condicoes de seguranca e justificativa de valor.</p>
            </article>
            <article className="feature-card">
              <h3>Viagem em andamento</h3>
              <p>Timeline, placa, PIN, suporte, sharing e SOS em hierarquia clara.</p>
            </article>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
