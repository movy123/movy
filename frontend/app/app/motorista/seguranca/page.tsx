import { AppShell } from "../../../ui/app-shell";
import { SectionHeader } from "../../../ui/section-header";

const navItems = [
  { href: "/app/motorista", label: "Painel" },
  { href: "/app/motorista/ganhos", label: "Ganhos" },
  { href: "/app/motorista/seguranca", label: "Seguranca" }
];

export default function DriverSafetyPage() {
  return (
    <AppShell
      role="motorista"
      currentPath="/app/motorista/seguranca"
      navItems={navItems}
      headerBadge="Protecao operacional"
    >
      <section className="panel stack-panel">
        <SectionHeader
          kicker="Seguranca"
          title="Protecao operacional deve acompanhar o motorista em toda a jornada."
          description="Aqui vamos consolidar incidentes, PIN, reputacao, alertas e suporte contextual."
        />
      </section>
    </AppShell>
  );
}
