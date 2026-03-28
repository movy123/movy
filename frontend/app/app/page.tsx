import Link from "next/link";

const spaces = [
  {
    href: "/app/passageiro",
    label: "Passageiro",
    title: "Solicitar, acompanhar e proteger a viagem",
    body: "Estimativa explicavel, status claros, suporte facil e centro de seguranca sempre acessivel."
  },
  {
    href: "/app/motorista",
    label: "Motorista",
    title: "Trabalhar com controle de receita e operacao",
    body: "Ofertas legiveis, ganho liquido visivel, carteira, metas e status operacional forte."
  },
  {
    href: "/app/admin",
    label: "Admin",
    title: "Ler a operacao e agir com rastreabilidade",
    body: "KPIs, incidentes, live operations, pagamentos e confianca operacional em uma unica camada."
  }
];

export default function PlatformIndexPage() {
  return (
    <main className="shell">
      <section className="hero panel">
        <div className="hero-copy">
          <span className="status-pill live">Frontend estruturado por papel</span>
          <h1>MOVY Platform Workspace para passageiro, motorista e operacao.</h1>
          <p>
            A partir daqui cada perfil passa a ter navegacao, prioridades visuais e contexto
            operacional proprios, sem misturar jornadas criticas na mesma tela.
          </p>
        </div>
      </section>

      <section className="pillar-grid">
        {spaces.map((space) => (
          <article key={space.href} className="pillar-card">
            <span className="section-kicker">{space.label}</span>
            <h2>{space.title}</h2>
            <p>{space.body}</p>
            <Link href={space.href} className="cta-link">
              Abrir workspace
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
