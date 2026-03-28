"use client";

import { useEffect, useState, useTransition } from "react";
import type { DriverOperationSnapshot } from "../../lib/driver";
import { formatCurrency, formatRelativeStatus } from "../../lib/dashboard";

async function requestDriverOperation(
  action?: "prepare" | "accept" | "start" | "complete",
  rideId?: string
) {
  const response = await fetch("/api/motorista/operacao", {
    method: action ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: action ? JSON.stringify({ action, rideId }) : undefined
  });

  const data = (await response.json()) as (DriverOperationSnapshot & { message?: string });
  if (!response.ok || !("driver" in data)) {
    throw new Error(data.message ?? "Nao foi possivel carregar a operacao do motorista.");
  }

  return data;
}

export function DriverOperations() {
  const [snapshot, setSnapshot] = useState<DriverOperationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await requestDriverOperation();
        setSnapshot(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar operacao.");
      }
    });
  }, []);

  const runAction = (action: "prepare" | "accept" | "start" | "complete") => {
    startTransition(async () => {
      try {
        setError(null);
        const data = await requestDriverOperation(action, snapshot?.ride?.id);
        setSnapshot(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao executar acao.");
      }
    });
  };

  const ride = snapshot?.ride;
  const canAccept = ride?.status === "MATCHED";
  const canStart = ride?.status === "ACCEPTED" || ride?.status === "CHECKED_IN";
  const canComplete = ride?.status === "IN_PROGRESS";

  return (
    <section className="panel stack-panel">
      <div className="section-head">
        <div>
          <span className="section-kicker">Cockpit operacional</span>
          <h2>Fluxo real do motorista</h2>
          <p className="section-copy">
            Esta area prepara uma corrida demo, faz o aceite e move o estado operacional da viagem.
          </p>
        </div>
        <span className="status-pill live">{snapshot?.driver.available ? "Disponivel" : "Offline"}</span>
      </div>

      <div className="hero-actions">
        <button type="button" className="action-button action-primary" onClick={() => runAction("prepare")} disabled={isPending}>
          {isPending ? "Processando..." : "Preparar corrida demo"}
        </button>
        <button type="button" className="action-button" onClick={() => runAction("accept")} disabled={!canAccept || isPending}>
          Aceitar corrida
        </button>
        <button type="button" className="action-button" onClick={() => runAction("start")} disabled={!canStart || isPending}>
          Iniciar viagem
        </button>
        <button type="button" className="action-button" onClick={() => runAction("complete")} disabled={!canComplete || isPending}>
          Concluir corrida
        </button>
      </div>

      {error ? <p className="feedback-error">{error}</p> : null}

      <div className="booking-grid">
        <article className="feature-card">
          <h3>Motorista ativo</h3>
          <p>
            {snapshot
              ? `${snapshot.driver.userName} | ${snapshot.driver.businessName} | score ${snapshot.driver.safetyScore}`
              : "Carregando perfil operacional."}
          </p>
        </article>
        <article className="feature-card">
          <h3>Carteira</h3>
          <p>
            {snapshot
              ? `${formatCurrency(snapshot.wallet.balance)} e ${snapshot.wallet.transactions} movimentacoes`
              : "Saldo e transacoes em leitura."}
          </p>
        </article>
        <article className="feature-card">
          <h3>Ultima notificacao</h3>
          <p>{snapshot?.notifications[0]?.title ?? "Sem notificacoes novas."}</p>
        </article>
      </div>

      <div className="estimate-stats">
        <article className="stat-card">
          <span className="card-label">Status da corrida</span>
          <strong>{ride ? formatRelativeStatus(ride.status as never) : "--"}</strong>
          <p>Estado atual do fluxo operacional do motorista.</p>
        </article>
        <article className="stat-card">
          <span className="card-label">Receita da corrida</span>
          <strong>{ride ? formatCurrency(ride.finalPrice ?? ride.suggestedPrice) : "--"}</strong>
          <p>Valor sugerido ou final da corrida em execucao.</p>
        </article>
        <article className="stat-card">
          <span className="card-label">Embarque</span>
          <strong>{ride ? ride.boardingPin : "--"}</strong>
          <p>PIN usado para check-in automatico da demo.</p>
        </article>
      </div>

      <div className="feature-list">
        <article className="feature-card">
          <h3>Origem</h3>
          <p>{ride?.origin.address ?? "Nenhuma corrida preparada."}</p>
        </article>
        <article className="feature-card">
          <h3>Destino</h3>
          <p>{ride?.destination.address ?? "Aguardando solicitacao."}</p>
        </article>
        <article className="feature-card">
          <h3>Ride ID</h3>
          <p>{ride ? ride.id.slice(0, 8) : "Sem corrida ativa."}</p>
        </article>
      </div>
    </section>
  );
}
