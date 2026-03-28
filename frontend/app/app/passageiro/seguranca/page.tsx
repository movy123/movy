import { AppShell } from "../../../ui/app-shell";
import { SectionHeader } from "../../../ui/section-header";

const navItems = [
  { href: "/app/passageiro", label: "Inicio" },
  { href: "/app/passageiro/estimativa", label: "Estimativa" },
  { href: "/app/passageiro/seguranca", label: "Seguranca" }
];

export default function PassengerSafetyPage() {
  return (
    <AppShell
      role="passageiro"
      currentPath="/app/passageiro/seguranca"
      navItems={navItems}
      headerBadge="Safety center"
    >
      <section className="panel stack-panel">
        <SectionHeader
          kicker="Seguranca"
          title="A MOVY precisa parecer segura antes, durante e depois da corrida."
          description="Aqui entraremos com safety center, trusted contacts, SOS, sharing e historico de checkpoints."
        />
      </section>
    </AppShell>
  );
}
