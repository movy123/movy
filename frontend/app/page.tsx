import {
  formatCompactNumber,
  formatCurrency,
  formatRelativeStatus,
  getDashboardData
} from "./lib/dashboard";

export const dynamic = "force-dynamic";

const journeys = [
  {
    title: "Passageiro no controle",
    body: "Escolha manual do motorista, preco transparente e acompanhamento em tempo real.",
    badge: "Escolha inteligente"
  },
  {
    title: "Motorista como negocio",
    body: "Preco proprio, agenda, territorio e leitura clara da margem liquida por corrida.",
    badge: "Autonomia"
  },
  {
    title: "Seguranca preventiva",
    body: "PIN de embarque, score de risco, trilha de eventos e monitoramento ativo da viagem.",
    badge: "Protecao operacional"
  }
];

export default async function HomePage() {
  const { overview, drivers, rides, payments, live, generatedAt } = await getDashboardData();

  return (
    <main className="page">
      <section className="hero">
        <span className="badge">{live ? "Painel conectado na API" : "Painel em fallback local"}</span>
        <h1>Centro de comando da MOVY para operacao, seguranca e rentabilidade.</h1>
        <p>
          Uma plataforma de mobilidade com despachos explicaveis, protecao contextual e visao de
          negocio para motoristas parceiros.
        </p>
        <p className="label">Atualizado em {new Date(generatedAt).toLocaleString("pt-BR")}</p>
      </section>

      <section className="grid">
        <article className="panel"><div className="label">Usuarios totais</div><div className="kpi">{formatCompactNumber(overview.kpis.totalUsers)}</div></article>
        <article className="panel"><div className="label">Motoristas ativos</div><div className="kpi">{overview.kpis.activeDrivers}</div></article>
        <article className="panel"><div className="label">Corridas em curso</div><div className="kpi">{overview.kpis.activeRides}</div></article>
        <article className="panel"><div className="label">Receita total</div><div className="kpi">{formatCurrency(overview.kpis.totalRevenue)}</div></article>
      </section>

      <section className="grid">
        {journeys.map((item) => (
          <article className="route" key={item.title}>
            <span className="badge">{item.badge}</span>
            <h2>{item.title}</h2>
            <p className="label">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Marketplace de motoristas</h2>
          <table>
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Negocio</th>
                <th>Preco/km</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.slice(0, 5).map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.user?.name ?? "Driver"}</td>
                  <td>{driver.businessName}</td>
                  <td>{formatCurrency(driver.basePricePerKm)}</td>
                  <td>{driver.available ? "Disponivel" : "Offline"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="panel">
          <h2>Governanca operacional</h2>
          <table>
            <tbody>
              <tr><td>Drivers verificados</td><td>{overview.security.verifiedDrivers}</td></tr>
              <tr><td>Veiculos verificados</td><td>{overview.operations.verifiedVehicles}</td></tr>
              <tr><td>Tickets abertos</td><td>{overview.operations.openSupportTickets}</td></tr>
              <tr><td>Sessoes ativas</td><td>{overview.operations.activeSessions}</td></tr>
              <tr><td>Usuarios com MFA</td><td>{overview.operations.mfaProtectedUsers}</td></tr>
              <tr><td>SOS abertos</td><td>{overview.security.openSosAlerts}</td></tr>
              <tr><td>Incidentes abertos</td><td>{overview.security.openSafetyIncidents}</td></tr>
              <tr><td>Sinais antifraude</td><td>{overview.security.openFraudSignals}</td></tr>
              <tr><td>Viagens liquidadas</td><td>{payments.settledTrips}</td></tr>
              <tr><td>Receita da plataforma</td><td>{formatCurrency(payments.platformRevenue)}</td></tr>
            </tbody>
          </table>
        </article>
      </section>

      <section className="panel">
        <h2>Corridas recentes</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Preco</th>
            </tr>
          </thead>
          <tbody>
            {rides.slice(0, 6).map((ride) => (
              <tr key={ride.id}>
                <td>{ride.id.slice(0, 8)}</td>
                <td>{ride.type}</td>
                <td>{formatRelativeStatus(ride.status)}</td>
                <td>{ride.origin.address}</td>
                <td>{ride.destination.address}</td>
                <td>{formatCurrency(ride.finalPrice ?? ride.suggestedPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
