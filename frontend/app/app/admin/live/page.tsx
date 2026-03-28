import { AppShell } from "../../../ui/app-shell";
import { SectionHeader } from "../../../ui/section-header";
import { formatCurrency, formatRelativeStatus } from "../../../lib/dashboard";
import { getAdminWorkspaceData } from "../../../lib/admin";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/app/admin", label: "Dashboard" },
  { href: "/app/admin/live", label: "Live Ops" },
  { href: "/app/admin/incidentes", label: "Incidentes" }
];

export default async function AdminLivePage() {
  const { rides, payments, overview, supportTickets, live } = await getAdminWorkspaceData();
  const liveRides = rides.filter((ride) => ["MATCHED", "ACCEPTED", "CHECKED_IN", "IN_PROGRESS"].includes(ride.status));
  const backlogTickets = supportTickets.filter((ticket) => ticket.status !== "RESOLVED");

  return (
    <AppShell role="admin" currentPath="/app/admin/live" navItems={navItems} headerBadge="Live ops">
      <section className="panel stack-panel">
        <SectionHeader
          kicker="Live operations"
          title="Mapa, filas e status operacionais precisam estar no mesmo plano de leitura."
          description="Esta rota agora consolida corridas ativas, backlog operacional, liquidez e sinais imediatos de atencao."
          aside={<span className={`status-pill ${live ? "live" : "fallback"}`}>{live ? "Dados ao vivo" : "Fallback local"}</span>}
        />
        <div className="estimate-stats">
          <article className="stat-card">
            <span className="card-label">Corridas ativas</span>
            <strong>{liveRides.length}</strong>
            <p>Status operacionais em acompanhamento imediato.</p>
          </article>
          <article className="stat-card">
            <span className="card-label">Tickets em fila</span>
            <strong>{backlogTickets.length}</strong>
            <p>Demandas de suporte ainda nao resolvidas.</p>
          </article>
          <article className="stat-card">
            <span className="card-label">Receita total</span>
            <strong>{formatCurrency(payments.totalRevenue)}</strong>
            <p>Leitura financeira agregada do momento operacional.</p>
          </article>
        </div>

        <div className="feature-list">
          {liveRides.slice(0, 3).map((ride) => (
            <article className="feature-card" key={ride.id}>
              <h3>{ride.origin.address}</h3>
              <p>
                {ride.destination.address} | {formatRelativeStatus(ride.status)} | {formatCurrency(ride.finalPrice ?? ride.suggestedPrice)}
              </p>
            </article>
          ))}
          {liveRides.length === 0 ? (
            <article className="feature-card">
              <h3>Sem corridas em curso</h3>
              <p>A operacao nao possui rides ativas neste momento.</p>
            </article>
          ) : null}
        </div>

        <div className="ride-table-wrap">
          <table className="ride-table">
            <thead>
              <tr>
                <th>Ride</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>SOS</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {liveRides.map((ride) => (
                <tr key={ride.id}>
                  <td>{ride.id.slice(0, 8)}</td>
                  <td>{formatRelativeStatus(ride.status)}</td>
                  <td>{ride.origin.address}</td>
                  <td>{ride.destination.address}</td>
                  <td>{ride.sosTriggered ? "Sim" : "Nao"}</td>
                  <td>{formatCurrency(ride.finalPrice ?? ride.suggestedPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="feature-list">
          <article className="feature-card">
            <h3>Drivers verificados</h3>
            <p>{overview.security.verifiedDrivers} condutores com status verificado.</p>
          </article>
          <article className="feature-card">
            <h3>SOS ativos</h3>
            <p>{overview.security.openSosAlerts} ocorrencias exigindo leitura imediata.</p>
          </article>
          <article className="feature-card">
            <h3>Sessoes ativas</h3>
            <p>{overview.operations.activeSessions} sessoes acompanhadas pela plataforma.</p>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
