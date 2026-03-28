# MOVY Blueprint

## 1. Resumo executivo

MOVY deve ser evoluida como uma plataforma de mobilidade confiavel, segura e explicavel, capaz de operar corridas urbanas, viagens agendadas e caronas intermunicipais em uma mesma fundacao. O repositorio atual ja comprova um MVP funcional com `backend`, `frontend`, `mobile`, `infra` e persistencia em memoria ou Prisma, mas ainda esta em estagio inicial frente a meta de mercado.

A decisao estrutural recomendada e manter a MOVY como um monolito modular orientado a dominio no curto e medio prazo, com eventos internos, filas e adaptadores externos bem definidos. Essa abordagem reduz custo operacional, acelera entrega e preserva uma trilha clara para escalar componentes criticos como matching, risco, notificacoes e payouts.

## 2. Premissas adotadas

- A base atual sera usada como fundacao, nao como descartavel.
- O foco inicial e Brasil, com preparacao para internacionalizacao.
- O MVP expandido deve priorizar seguranca, transparência financeira e autonomia do motorista antes de sofisticacoes perifericas.
- O backend continuara em Node.js + TypeScript, com Prisma + PostgreSQL como stack principal de dados.
- Redis sera introduzido na fase seguinte para cache, rate limiting, filas leves e fan-out realtime.
- A primeira operacao deve suportar mobilidade urbana e viagens agendadas; carona intermunicipal entra na mesma arquitetura com regras operacionais distintas.
- A MOVY deve operar sob LGPD, trilha de auditoria, segregacao de papeis e base antifraude desde o inicio.

## 3. Benchmark de mercado

### Uber

- Pontos fortes: Safety Toolkit, botao de emergencia, PIN, Share My Trip, RideCheck e selfie periodica do motorista ([Uber Safety](https://www.uber.com/us/en/ride/safety/), [Uber Commitment](https://www.uber.com/us/en/safety/our-commitment/)).
- Pontos fortes: visibilidade de ganhos no Earnings Hub, extrato semanal e detalhamento de tarifas ([Uber Earnings](https://www.uber.com/us/en/drive/how-much-drivers-make/)).
- Lacunas percebidas: transparencia ainda insuficiente sobre formacao de preco e fee efetiva por corrida; pressao regulatoria sobre cancelamento e cobranca em produtos de assinatura mostra risco reputacional relevante ([FTC vs Uber, 21 Apr 2025](https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-takes-action-against-uber-deceptive-billing-cancellation-practices)).

### Lyft

- Pontos fortes: monitoramento de rota, audio recording, trusted contacts, PIN, equipe de seguranca 24/7 e verificacao de rider em cenarios especificos ([Lyft Safety](https://www.lyft.com/safety), [Lyft Rider Verification](https://www.lyft.com/safety/rider-verification)).
- Pontos fortes: compromisso explicito de ganhos minimos de 70% dos pagamentos do passageiro apos taxas externas, com tracker de transparencia ([Lyft Earnings Commitment](https://help.lyft.com/hc/en-us/all/articles/9785135090-earnings-commitment/)).
- Oportunidade para MOVY: superar o mercado com transparencia por corrida, nao apenas semanal, e transformar motorista em operador com centro financeiro completo.

### BlaBlaCar

- Pontos fortes: marca ancorada em confianca, multimodalidade e eficiencia de ocupacao; crescimento forte no Brasil e em rotas de media distancia ([BlaBlaCar Financing, 04 Apr 2024](https://newsroom.blablacar.com/news/blablacar-closes-financing-round-to-fuel-its-growth-ambitions), [BlaBlaCar Train, 15 May 2025](https://blog.blablacar.com/newsroom/news-list/blablacar-now-sells-train-tickets-in-france), [BlaBlaCar Sustainability Report, 02 May 2025](https://newsroom.blablacar.com/news/sustainability-report-2024)).
- Pontos fortes: proposta multimodal e melhor encaixe para carona interurbana e recorrente.
- Oportunidade para MOVY: combinar confianca de carona com controle operacional em tempo real, algo mais proximo de um hibrido entre ride-hailing e trusted travel marketplace.

### Sintese competitiva

- O mercado ja normalizou SOS, tracking e PIN; isso nao e diferencial, e baseline.
- O verdadeiro espaco competitivo esta em: explicabilidade de preco, autonomia operacional do motorista, score de risco pre-trip, trilha auditavel da viagem e operacao hibrida urbana + interurbana.
- Evidencia academica recente reforca que transparencia de ganhos e desenho da plataforma alteram equidade, comportamento e retencao do motorista ([Lyft transparency natural experiment, Feb 2026](https://arxiv.org/abs/2602.08955), [Chicago rideshare earnings study, Feb 2025](https://arxiv.org/abs/2502.08893)).

## 4. Proposta de valor da MOVY

### Para passageiros

- Escolha com clareza entre economia, rapidez, seguranca e conforto.
- Preco explicado antes da corrida, com justificativas simples e auditaveis.
- Mais controle da jornada: PIN, timeline, rota compartilhada, alertas de desvio e suporte contextual.
- Mais confianca no condutor e na plataforma via identidade validada e score bidirecional.

### Para motoristas

- Painel empresario com precificacao assistida, metas, agenda, area de atuacao e analise de rentabilidade.
- Visao clara do que o passageiro pagou, taxa da plataforma, custo externo e ganho liquido.
- Melhor filtro operacional: tipos de corrida, passageiros preferidos, zonas, horarios e rotas recorrentes.
- Menos arbitrariedade operacional com politicas explicitas, score justo e direito de contestacao.

### Para a plataforma

- Retencao de motoristas via previsibilidade e autonomia.
- Menor risco operacional com risco contextual, antifraude e incident response estruturado.
- Capacidade de expandir para corporativo, frota, delivery leve e marketplace multimodal.

## 5. Arquitetura sugerida

### Decisao principal

Adotar monolito modular com arquitetura em camadas:

- `domain`: entidades, value objects, invariantes, politicas e eventos.
- `application`: casos de uso, orquestracao, transacoes, idempotencia e autorizacao.
- `infrastructure`: Prisma, Redis, providers de pagamento, KYC, mapas, notificacoes, storage.
- `interfaces`: REST, WebSocket, webhooks, jobs e paines operacionais.

### Bounded contexts iniciais

- Identity and Access
- Passenger
- Driver Operations
- Vehicle and Compliance
- Ride Orchestration
- Dispatch and Matching
- Pricing and Incentives
- Safety and Trust
- Payments and Wallet
- Reviews and Reputation
- Notifications
- Support and Disputes
- Admin and Feature Flags
- Analytics and Risk

### Padroes obrigatorios

- JWT access token + refresh token rotativo + MFA step-up para acoes sensiveis.
- RBAC base com pontos de ABAC para suporte, antifraude e compliance.
- Versionamento REST em `/api/v1`.
- Idempotency-Key para criacao de corrida, pagamentos, payouts e tickets.
- Outbox pattern para notificacoes, auditoria e eventos criticos.
- Retry com backoff para providers externos.
- Rate limiting por IP, usuario, dispositivo e acao sensivel.
- Feature flags para rollout de precificacao, score de risco, PIN obrigatorio e audio seguro.
- Logs estruturados, tracing distribuido e metricas de negocio e operacao.

### Servicos externos previstos

- Mapas e rotas: Google Maps Platform, Mapbox ou stack open-source com fallback.
- KYC/KYB: provider especializado para documento, selfie e liveness.
- Pagamentos: gateway com PIX, cartao, split e antifraude.
- Comunicacao: e-mail, SMS e push com filas assicronas.
- Storage: S3 compativel para documentos e anexos com criptografia.

## 6. Fluxos do sistema

### Fluxo fim a fim prioritario

1. Passageiro cria conta, valida telefone e define trusted contacts.
2. Motorista cria conta, passa por KYC, cadastra veiculo e documentos.
3. Operacao antifraude aprova, rejeita ou pede revisao.
4. Motorista define disponibilidade, zonas e preferencias.
5. Passageiro solicita corrida imediata, agendada ou interurbana.
6. Motor de precificacao gera estimativa, breakdown e risco pre-trip.
7. Matching ranqueia candidatos por distancia, confianca, preferencia e rentabilidade.
8. Motorista aceita; sistema trava versao da oferta e ETA.
9. Chegada ao embarque com PIN obrigatorio quando score de risco exigir.
10. Corrida inicia com tracking, event stream e monitoramento de desvio/parada.
11. Incidentes podem abrir SOS, suporte, verificacao extra ou bloqueio preventivo.
12. Conclusao dispara cobranca, split, repasse, reputacao e analytics.
13. Em caso de disputa, a trilha auditavel alimenta o workflow de suporte.

### Estados recomendados para `Ride`

- `REQUESTED`
- `PRICED`
- `MATCHING`
- `MATCHED`
- `DRIVER_ACCEPTED`
- `DRIVER_ARRIVING`
- `BOARDING_PENDING`
- `BOARDING_CONFIRMED`
- `IN_PROGRESS`
- `PAUSED`
- `COMPLETED`
- `CANCELLED_BY_PASSENGER`
- `CANCELLED_BY_DRIVER`
- `CANCELLED_BY_SYSTEM`
- `DISPUTED`

## 7. Modelagem de dados

### Diagnostico do estado atual

O schema atual cobre `User`, `DriverProfile`, `Ride`, `Payment`, `Review` e `Notification`, mas ainda nao cobre identidade forte, seguranca, carteira, reputacao estruturada, auditoria, suporte, antifraude e operacao administrativa.

### Entidades alvo

- `User`: identidade base, status, origem do cadastro, telefone verificado, MFA status, locale, timezone.
- `Role`: papel sistemico e escopo administrativo.
- `Profile`: dados pessoais comuns, consentimentos, status de verificacao.
- `PassengerProfile`: preferencias, trusted contacts, score de confiabilidade, restricoes.
- `DriverProfile`: KYC, operacao, preferencias, metrics, score de seguranca, status operacional.
- `DriverDocument`: CNH, CRLV, comprovantes, status de validacao, vencimento, storage key.
- `Vehicle`: categoria, placa, ano, cor, capacidade, acessibilidade, status de aprovacao.
- `VehicleDocument`: seguro, licenciamento, vistoria e vencimentos.
- `AvailabilityWindow`: dia da semana, inicio, fim, area, recorrencia.
- `ServiceArea`: cidade, poligono, zona, regra operacional e prioridade.
- `Ride`: pedido e execucao da viagem.
- `RideStop`: multiplas paradas com ordem, ETA e precificacao incremental.
- `RideRoute`: snapshot de rota, provider, distancia, duracao, geometria resumida.
- `RideEvent`: transicao de estado, ator, metadados, idempotency key.
- `RideTrackingPoint`: serie temporal de coordenadas, velocidade, heading e fonte.
- `FareEstimate`: estimativa apresentada, validade, versao do algoritmo e score de risco.
- `FareBreakdown`: base, distancia, tempo, demanda, pedagio, taxa plataforma, desconto.
- `PaymentMethod`: token de cartao, PIX, wallet, preferencia e risco.
- `PaymentTransaction`: autorizacao, captura, estorno, chargeback, reconciliacao.
- `Wallet`: saldo disponivel, reservado, moeda e status.
- `WalletTransaction`: credito, debito, ajuste, reserva, desbloqueio.
- `Payout`: saque do motorista, status, lote, falha e reconciliacao.
- `Review`: avaliacao contextual por viagem.
- `ReputationScore`: score agregado por dimensao e janela temporal.
- `SafetyIncident`: incidente, severidade, status, protocolo e evidencias.
- `EmergencyContact`: nome, canal, prioridade e consentimento.
- `SupportTicket`: tipo, SLA, contexto da viagem, responsavel e resolucao.
- `AuditLog`: quem fez o que, quando, por qual interface, com diff resumido.
- `DeviceSession`: dispositivo, refresh token hash, IP, reputacao e ultima atividade.
- `Notification`: fila e historico transacional.
- `Coupon`: promocao, regras, janela, orcamento e limite.
- `Campaign`: incentivo para aquisicao, retencao ou oferta.
- `FraudSignal`: sinal bruto, origem, confianca e janela.
- `RiskScore`: score consolidado pre-trip, on-trip ou financeiro.
- `FeatureFlag`: chave, ambiente, alvo, rollout e auditoria.

### Indices e constraints chave

- `User.email`, `User.phoneE164` unicos.
- `DriverDocument(driverId, type, expiresAt)` indexado.
- `Ride(status, requestedAt)`, `Ride(driverId, status)`, `Ride(passengerId, createdAt)`.
- `RideTrackingPoint(rideId, capturedAt)` particionado por tempo.
- `PaymentTransaction(providerReference)` unico.
- `AuditLog(actorUserId, occurredAt)` e `AuditLog(entityType, entityId, occurredAt)`.
- `RiskScore(entityType, entityId, generatedAt desc)`.

### Politicas de privacidade e retencao

- Documentos sensiveis com criptografia em repouso e URL assinada.
- Tracking bruto com TTL operacional e agregacao posterior.
- Audio e evidencias somente mediante consentimento, evento de seguranca ou exigencia legal.
- Minimizar retenção de PII nao essencial.

## 8. Estrutura de pastas

```text
movy/
  backend/
    src/
      modules/
        identity/
        passengers/
        drivers/
        vehicles/
        rides/
        dispatch/
        pricing/
        safety/
        payments/
        wallet/
        reviews/
        support/
        notifications/
        admin/
        analytics/
      shared/
        kernel/
        auth/
        observability/
        persistence/
        messaging/
        feature-flags/
    prisma/
  frontend/
    app/
      (marketing)/
      (passenger)/
      (driver)/
      (admin)/
  mobile/
    src/
      features/
        auth/
        passenger/
        driver/
        safety/
        wallet/
        support/
      shared/
  docs/
    architecture.md
    movy-blueprint.md
  infra/
    docker-compose.yml
    ci.yml
    k8s/
    terraform/
```

## 9. APIs e contratos

### Contratos iniciais de alto valor

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/mfa/challenge`
- `POST /api/v1/drivers/onboarding`
- `POST /api/v1/drivers/:driverId/documents`
- `POST /api/v1/vehicles`
- `POST /api/v1/rides/estimates`
- `POST /api/v1/rides`
- `POST /api/v1/rides/:rideId/match`
- `POST /api/v1/rides/:rideId/accept`
- `POST /api/v1/rides/:rideId/boarding/verify-pin`
- `POST /api/v1/rides/:rideId/start`
- `POST /api/v1/rides/:rideId/sos`
- `POST /api/v1/rides/:rideId/complete`
- `POST /api/v1/support/tickets`
- `GET /api/v1/admin/overview`

### Exemplo de contrato de estimativa

```json
{
  "origin": { "lat": -23.563099, "lng": -46.654419, "address": "Av. Paulista, Sao Paulo" },
  "destination": { "lat": -23.566740, "lng": -46.692970, "address": "Pinheiros, Sao Paulo" },
  "rideMode": "URBAN",
  "serviceLevel": "BALANCED",
  "scheduledFor": null,
  "stops": []
}
```

Resposta:

```json
{
  "estimateId": "uuid",
  "expiresAt": "2026-03-28T12:10:00.000Z",
  "riskScore": 0.18,
  "fare": {
    "currency": "BRL",
    "suggestedPrice": 28.40,
    "minPrice": 24.90,
    "maxPrice": 31.50,
    "breakdown": {
      "base": 6.00,
      "distance": 14.10,
      "time": 4.80,
      "demand": 1.50,
      "platformFee": 4.20,
      "discount": 0
    }
  },
  "boardingPolicy": {
    "pinRequired": true,
    "extraVerification": false
  }
}
```

## 10. Regras de negocio

- Toda corrida deve nascer de uma `FareEstimate` versionada.
- O motorista pode definir preco dentro de bandas permitidas por politica, categoria e contexto.
- Corridas com score de risco acima do limiar exigem PIN, step-up de identidade ou bloqueio.
- Passageiro e motorista nao podem concluir corrida sem estado anterior valido.
- Eventos financeiros devem ser idempotentes e reconciliaveis.
- Toda intervencao humana em suporte, fraude, payout ou configuracao sensivel deve gerar `AuditLog`.
- Cancelamentos devem preservar motivo, ator, score de impacto e eventual penalidade revisavel.
- Corridas intermunicipais exigem regras especificas de janela, bagagem, paradas e taxa.

## 11. Seguranca e antifraude

- KYC motorista com documento, selfie, liveness, validacao cruzada e reverificacao periodica.
- Verificacao de passageiro acionavel por risco, valor, horario, area ou historico.
- Device fingerprint, reputacao de sessao e analise de anomalia.
- Score de risco composto por identidade, comportamento, geografia, pagamento e historico.
- SOS com fila de incidentes, severidade, protocolo e rastreabilidade completa.
- Protecoes OWASP: validacao forte, JWT seguro, hash forte, segredo fora do codigo, limites de abuso, CORS restritivo, sanitize e schema validation.
- Audio protegido com consentimento, upload criptografado, acesso justificado e retention control.

## 12. UX/UI

### Direcao de experiencia

- UX de confianca, nao de improviso: linguagem clara, estado da corrida sempre visivel e risco nunca escondido.
- Interface deve explicar decisoes importantes: preco, score, verificacoes e pendencias.
- Acoes criticas em um toque: SOS, compartilhar viagem, ligar para suporte, verificar PIN.

### Jornadas prioritarias

- Passageiro: onboarding, estimativa, escolha da opcao, corrida, seguranca, pagamento, historico, suporte.
- Motorista: onboarding, aprovacao, online/offline, oferta de viagem, navegacao, carteira, desempenho, seguranca.
- Admin: live operations, incidentes, antifraude, payouts, disputas, feature flags e analytics.

## 13. Plano de testes

### Cobertura recomendada

- Unitarios: 80%+ nos modulos de dominio, precificacao, risco, payouts e transicoes de estado.
- Integracao: persistencia, auth, rides, matching, payments, notifications e support.
- E2E: cadastro, KYC, solicitação, match, embarque por PIN, SOS, conclusao, disputa e reembolso.
- Contrato: provedores de pagamento, mapas, KYC e webhooks.
- Carga: estimativas, matchmaking, tracking e dashboards ao vivo.
- Resiliencia: falha de gateway, timeout de mapa, fila atrasada, duplicidade de webhook, retry seguro.

### Casos obrigatorios

- Fluxo feliz e triste para corrida imediata, agendada e interurbana.
- Double submit com mesma `Idempotency-Key`.
- Divergencia entre valor autorizado e valor final.
- Desvio de rota, parada longa e SOS.
- Chargeback, estorno parcial e payout com falha.
- Usuario bloqueado tentando operar corrida em andamento.

## 14. Plano de deploy

- Ambientes: `local`, `staging`, `production`.
- Docker para todos os apps; CI executa lint, tests, build e checks de schema.
- Banco com migracoes versionadas e seed segura para `staging`.
- Secrets via secret manager, nunca no repositorio.
- Observabilidade minima: OpenTelemetry, logs JSON, Prometheus, Grafana, alertas por erro, latencia, falha financeira e incidentes de seguranca.
- Deploy progressivo com feature flags para modulos sensiveis.

## 15. Roadmap por fases

### Fase 0 - Fundacao imediata

- Consolidar arquitetura alvo.
- Expandir schema Prisma para dominio principal.
- Introduzir `/api/v1` e contratos estaveis.
- Adicionar `AuditLog`, `DeviceSession`, `Wallet`, `RideEvent`, `RiskScore`.

### Fase 1 - MVP confiavel

- Onboarding passageiro e motorista.
- KYC basico.
- Estimativa explicavel.
- Match, aceite, PIN, inicio, tracking e conclusao.
- Split financeiro simples.
- Painel admin operacional.

### Fase 2 - Diferenciais MOVY

- Modo empresario do motorista.
- Score de risco pre-trip e on-trip.
- Timeline auditavel completa.
- Wallet com previsao de recebiveis.
- Disputas e reembolsos estruturados.

### Fase 3 - Escala e inteligencia

- Redis, filas e websockets robustos.
- Recomendacao de zonas lucrativas.
- Campanhas e cohort analytics.
- Antifraude comportamental e regras adaptativas.
- Corporate rides e rotas recorrentes.

### Fase 4 - Expansao

- Carona intermunicipal madura.
- Frota e submotoristas.
- APIs parceiras.
- Localizacao internacional e compliance regional.

## 16. Riscos e mitigacao

- Complexidade excessiva cedo: mitigar com monolito modular e entregas fatiadas.
- Risco regulatorio e LGPD: mitigar com privacy by design, auditoria e base de consentimento.
- Fraude documental e financeira: mitigar com KYC, score, step-up e reconciliacao.
- Falta de confianca do motorista: mitigar com transparencia por corrida, extrato forte e politicas claras.
- Falha operacional em incidente real: mitigar com runbooks, fila de incidentes e simulados.
- Dependencia externa de mapas/KYC/pagamento: mitigar com adaptadores, timeout, retry e fallback.

## 17. Proxima acao tecnica recomendada

Executar a Fase 0 no codigo atual em quatro entregas curtas:

1. Reestruturar o backend para `api/v1` e bounded contexts explicitos.
2. Expandir o schema Prisma com identidade, auditoria, wallet, ride events e risk score.
3. Implementar um fluxo de estimativa explicavel + criacao de corrida baseada em `FareEstimate`.
4. Evoluir frontend e mobile de landing/demo para jornadas reais de passageiro, motorista e operacao.

## Anexo - Diagnostico objetivo do repositorio atual

- Ponto forte: base monorepo simples e funcional, com Fastify, Prisma, Next.js, Expo e Docker.
- Ponto forte: ja existe fluxo autenticado de corrida com match, aceite e conclusao.
- Gap principal: falta um modelo de dominio mais rico para seguranca, risco, carteira, auditoria e suporte.
- Gap principal: frontend e mobile ainda operam como demonstracao institucional, nao como produto operacional.
- Gap principal: faltam contratos versionados, observabilidade real, Redis, filas e governance de dados.
