import { AppShell } from "../../../ui/app-shell";
import { SectionHeader } from "../../../ui/section-header";
import { getAdminWorkspaceData } from "../../../lib/admin";
import { formatRelativeStatus } from "../../../lib/dashboard";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/app/admin", label: "Dashboard" },
  { href: "/app/admin/live", label: "Live Ops" },
  { href: "/app/admin/incidentes", label: "Incidentes" }
];

export default async function AdminIncidentsPage() {
  const { rides, supportTickets, incidents, fraudSignals, users, live } = await getAdminWorkspaceData();
  const incidentRides = rides.filter((ride) => ride.sosTriggered || ride.status === "CANCELLED");
  const criticalTickets = supportTickets.filter((ticket) => ticket.status !== "RESOLVED");
  const activeIncidents = incidents.filter((incident) => incident.status !== "RESOLVED");
  const activeFraudSignals = fraudSignals.filter((signal) => signal.status !== "RESOLVED");

  return (
    <AppShell
      role="admin"
      currentPath="/app/admin/incidentes"
      navItems={navItems}
      headerBadge="Incidentes"
    >
      <section className="panel stack-panel">
        <SectionHeader
          kicker="Incidentes"
          title="Toda intervencao precisa ser rapida, contextual e auditavel."
          description="Esta area agora cruza tickets operacionais com corridas sensiveis para orientar resposta e triagem."
          aside={<span className={`status-pill ${live ? "live" : "fallback"}`}>{live ? "Dados ao vivo" : "Fallback local"}</span>}
        />
        <div className="estimate-stats">
          <article className="stat-card stat-danger">
            <span className="card-label">Rides sensiveis</span>
            <strong>{incidentRides.length}</strong>
            <p>Corridas com SOS ou cancelamento relevante.</p>
          </article>
          <article className="stat-card stat-warning">
            <span className="card-label">Tickets abertos</span>
            <strong>{criticalTickets.length}</strong>
            <p>Fila de suporte ainda sem resolucao.</p>
          </article>
          <article className="stat-card stat-danger">
            <span className="card-label">Sinais antifraude</span>
            <strong>{activeFraudSignals.length}</strong>
            <p>Indicadores de comportamento anomalo ou violacao de protocolo.</p>
          </article>
          <article className="stat-card">
            <span className="card-label">Prioridade operacional</span>
            <strong>{incidentRides.length + criticalTickets.length + activeIncidents.length + activeFraudSignals.length}</strong>
            <p>Soma de itens que exigem leitura humana.</p>
          </article>
        </div>

        <div className="feature-list">
          {activeIncidents.slice(0, 2).map((incident) => (
            <article className="feature-card" key={incident.id}>
              <h3>{incident.type}</h3>
              <p>
                {incident.summary} | {incident.status} | Ride {incident.rideId.slice(0, 8)}
              </p>
            </article>
          ))}
          {activeFraudSignals.slice(0, 2).map((signal) => (
            <article className="feature-card" key={signal.id}>
              <h3>{signal.type}</h3>
              <p>
                {signal.summary} | {signal.severity} | {signal.rideId ? `Ride ${signal.rideId.slice(0, 8)}` : "Conta"}
              </p>
            </article>
          ))}
          {criticalTickets.slice(0, 3).map((ticket) => (
            <article className="feature-card" key={ticket.id}>
              <h3>{ticket.category}</h3>
              <p>
                {ticket.summary} | {ticket.status} | {ticket.rideId ? `Ride ${ticket.rideId.slice(0, 8)}` : "Sem ride"}
              </p>
            </article>
          ))}
          {criticalTickets.length === 0 ? (
            <article className="feature-card">
              <h3>Sem tickets criticos</h3>
              <p>Nao ha tickets pendentes para triagem administrativa.</p>
            </article>
          ) : null}
        </div>

        <div className="ride-table-wrap">
          <table className="ride-table">
            <thead>
              <tr>
                <th>Ride</th>
                <th>Status</th>
                <th>SOS</th>
                <th>Origem</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>
              {incidentRides.map((ride) => (
                <tr key={ride.id}>
                  <td>{ride.id.slice(0, 8)}</td>
                  <td>{formatRelativeStatus(ride.status)}</td>
                  <td>{ride.sosTriggered ? "Sim" : "Nao"}</td>
                  <td>{ride.origin.address}</td>
                  <td>{ride.destination.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ride-table-wrap">
          <table className="ride-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Papel</th>
                <th>MFA</th>
                <th>Trust score</th>
                <th>Avaliacao</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 6).map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.role}</td>
                  <td>{user.mfaEnabled ? "Ativo" : "Desligado"}</td>
                  <td>{user.reputation.trustScore}</td>
                  <td>{user.reputation.averageScore || user.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
