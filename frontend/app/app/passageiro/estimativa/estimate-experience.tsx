"use client";

import { useState, useTransition } from "react";
import type { BookedRideResponse, FareEstimateResponse } from "../../../lib/passenger";
import { getRiskTone } from "../../../lib/passenger";
import { formatCurrency } from "../../../lib/dashboard";

const presets = {
  origin: {
    address: "Av. Paulista, Bela Vista",
    lat: -23.563099,
    lng: -46.654419
  },
  destination: {
    address: "Pinheiros, Sao Paulo",
    lat: -23.56674,
    lng: -46.69297
  }
};

export function EstimateExperience() {
  const [estimate, setEstimate] = useState<FareEstimateResponse | null>(null);
  const [bookedRide, setBookedRide] = useState<BookedRideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEstimating, startEstimateTransition] = useTransition();
  const [isBooking, startBookingTransition] = useTransition();

  const requestEstimate = () => {
    startEstimateTransition(async () => {
      setError(null);
      setBookedRide(null);

      const response = await fetch("/api/passageiro/estimativa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...presets,
          type: "INSTANT"
        })
      });

      const data = (await response.json()) as { estimate?: FareEstimateResponse; message?: string };
      if (!response.ok || !data.estimate) {
        setEstimate(null);
        setError(data.message ?? "Nao foi possivel gerar a estimativa.");
        return;
      }

      setEstimate(data.estimate);
    });
  };

  const bookRide = () => {
    if (!estimate) {
      return;
    }

    startBookingTransition(async () => {
      setError(null);

      const response = await fetch("/api/passageiro/estimativa", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          estimateId: estimate.id
        })
      });

      const data = (await response.json()) as (BookedRideResponse & { message?: string });
      if (!response.ok || !("ride" in data)) {
        setBookedRide(null);
        setError(data.message ?? "Nao foi possivel reservar a corrida.");
        return;
      }

      setBookedRide(data);
    });
  };

  return (
    <div className="estimate-layout">
      <section className="panel estimate-panel">
        <div className="estimate-form-copy">
          <span className="section-kicker">Fluxo real</span>
          <h3>Estimativa conectada ao backend</h3>
          <p>
            Esta tela usa o novo contrato `FareEstimate` para gerar preco, risco e politica de embarque
            antes da reserva da corrida.
          </p>
        </div>

        <div className="estimate-preset">
          <div>
            <span className="card-label">Origem</span>
            <strong>{presets.origin.address}</strong>
          </div>
          <div>
            <span className="card-label">Destino</span>
            <strong>{presets.destination.address}</strong>
          </div>
          <div>
            <span className="card-label">Servico</span>
            <strong>Instantaneo</strong>
          </div>
        </div>

        <div className="hero-actions">
          <button type="button" className="action-button action-primary" onClick={requestEstimate} disabled={isEstimating}>
            {isEstimating ? "Calculando..." : "Gerar estimativa"}
          </button>
          <button
            type="button"
            className="action-button"
            onClick={bookRide}
            disabled={!estimate || isBooking}
          >
            {isBooking ? "Reservando..." : "Reservar com estimateId"}
          </button>
        </div>

        {error ? <p className="feedback-error">{error}</p> : null}
      </section>

      <section className="panel estimate-panel">
        <div className="section-head">
          <div>
            <span className="section-kicker">Resposta operacional</span>
            <h3>Preco, risco e politica de embarque</h3>
          </div>
          {estimate ? (
            <span className={`risk-badge risk-${getRiskTone(estimate.riskLevel)}`}>{estimate.riskLevel}</span>
          ) : (
            <span className="meta-pill">Aguardando calculo</span>
          )}
        </div>

        <div className="estimate-stats">
          <article className="stat-card">
            <span className="card-label">Preco sugerido</span>
            <strong>{estimate ? formatCurrency(estimate.suggestedPrice) : "--"}</strong>
            <p>Faixa operacional entre minimo e maximo aceitos.</p>
          </article>
          <article className="stat-card">
            <span className="card-label">ETA</span>
            <strong>{estimate ? `${estimate.estimatedMinutes} min` : "--"}</strong>
            <p>Tempo estimado para o deslocamento completo.</p>
          </article>
          <article className="stat-card">
            <span className="card-label">PIN obrigatorio</span>
            <strong>{estimate ? (estimate.pinRequired ? "Sim" : "Nao") : "--"}</strong>
            <p>Politica pre-trip definida pelo score de risco.</p>
          </article>
        </div>

        <div className="feature-list">
          <article className="feature-card">
            <h3>Banda de preco</h3>
            <p>
              {estimate
                ? `${formatCurrency(estimate.minPrice)} ate ${formatCurrency(estimate.maxPrice)}`
                : "A faixa aparece assim que o estimate e calculado."}
            </p>
          </article>
          <article className="feature-card">
            <h3>Score de risco</h3>
            <p>{estimate ? estimate.riskScore.toFixed(2) : "Risco contextual antes da reserva."}</p>
          </article>
          <article className="feature-card">
            <h3>Validade</h3>
            <p>
              {estimate
                ? new Date(estimate.expiresAt).toLocaleTimeString("pt-BR")
                : "Estimate expira para evitar preco stale."}
            </p>
          </article>
        </div>
      </section>

      <section className="panel estimate-panel">
        <div className="section-head">
          <div>
            <span className="section-kicker">Reserva</span>
            <h3>Conversao de estimate para ride</h3>
          </div>
          {bookedRide ? <span className="status-pill live">Corrida reservada</span> : <span className="meta-pill">Pendente</span>}
        </div>

        {bookedRide ? (
          <div className="booking-grid">
            <article className="feature-card">
              <h3>Status da ride</h3>
              <p>ID {bookedRide.ride.id.slice(0, 8)} em estado {bookedRide.ride.status}.</p>
            </article>
            <article className="feature-card">
              <h3>Motorista sugerido</h3>
              <p>
                {bookedRide.candidates[0]
                  ? `${bookedRide.candidates[0].driverUser.name} (${bookedRide.candidates[0].etaMinutes} min)`
                  : "Sem candidato disponivel no momento."}
              </p>
            </article>
            <article className="feature-card">
              <h3>Preco reservado</h3>
              <p>{formatCurrency(bookedRide.ride.suggestedPrice)} com trilha de risco ativa.</p>
            </article>
          </div>
        ) : (
          <p className="section-copy">
            Depois da estimativa, a reserva usa `estimateId` e cria a corrida com o mesmo contexto de preco,
            risco e politicas de embarque.
          </p>
        )}
      </section>
    </div>
  );
}
