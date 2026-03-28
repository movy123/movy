import { formatCurrency } from "../../../lib/dashboard";
import { AppShell } from "../../../ui/app-shell";
import { SectionHeader } from "../../../ui/section-header";
import { EstimateExperience } from "./estimate-experience";

const navItems = [
  { href: "/app/passageiro", label: "Inicio" },
  { href: "/app/passageiro/estimativa", label: "Estimativa" },
  { href: "/app/passageiro/seguranca", label: "Seguranca" }
];

export default function PassengerEstimatePage() {
  return (
    <AppShell
      role="passageiro"
      currentPath="/app/passageiro/estimativa"
      navItems={navItems}
      headerBadge="Preco explicavel"
    >
      <section className="panel stack-panel">
        <SectionHeader
          kicker="Estimativa"
          title="Antes de pedir a viagem, o passageiro precisa entender o valor."
          description="Esta rota agora conversa com o backend da MOVY e materializa o fluxo estimativa -> reserva -> aguardando motorista."
        />
        <div className="feature-list">
          <article className="feature-card">
            <h3>Valor total</h3>
            <p>{formatCurrency(28.4)} com ETA de 6 minutos.</p>
          </article>
          <article className="feature-card">
            <h3>Breakdown</h3>
            <p>Distancia, tempo, demanda e taxa da plataforma sem caixa-preta.</p>
          </article>
          <article className="feature-card">
            <h3>Confianca</h3>
            <p>PIN, suporte e compartilhamento apresentados antes da confirmacao.</p>
          </article>
        </div>
      </section>

      <EstimateExperience />
    </AppShell>
  );
}
