# MOVY Frontend Strategy

## 1. Benchmark de mercado de UX para mobilidade

### O que o mercado ja consolidou como baseline

- Preco antecipado e visivel antes da confirmacao da corrida. Uber destaca upfront pricing com rota e tempo estimados; Grab faz o mesmo em multiplos mercados.
- Centro de seguranca dentro da viagem. Uber, Lyft e Grab concentram SOS, compartilhamento e verificacao em pontos de acesso rapidos.
- Tracking ativo da viagem com status claros e identificacao do motorista/veiculo.
- Reputacao bidirecional e screening de condutor como mecanismo de confianca.

### O que os principais players mostram hoje

#### Uber

- Valor percebido forte em `upfront pricing`, `RideCheck`, `PIN verification`, `Share my trip`, `Safety Toolkit` e `verified rider badge`.
- UX forte em reduzir ambiguidade: preco, rota, ETA e seguranca aparecem cedo.
- Gap recorrente: explicacao insuficiente do porque o preco variou e pouca sensacao de autonomia economica para o motorista.

#### Lyft

- Se diferencia em previsibilidade de gasto com `Price Lock` e em seguranca identitaria com `Women+ Connect` e controles de verificacao.
- A UX trabalha muito bem o conceito de “controle” para rider recorrente.
- Gap: parte da previsibilidade vem por produto de assinatura/passe, nao por explicacao transparente de cada corrida.

#### Grab

- Excelente em clareza transacional e operacao multimodal: tipos de servico, preco antecipado, status e safety center acessivel.
- Mostra bem como super app e mobilidade podem conviver sem poluir a jornada principal.
- Boa referencia para organizacao de app com muitas ofertas sem perder legibilidade.

#### inDrive

- Diferencial forte em escolha e negociacao de tarifa, reforcando a tese de transparencia e autonomia.
- UX baseada em “escolha explicita” e nao apenas despacho opaco.
- Risco: negociacao demais pode aumentar friccao e reduzir confianca se nao houver limites e boa mediação de produto.

#### BlaBlaCar

- Muito forte em confianca social: perfil, recorrencia, avaliacao, verificacao e contexto da viagem.
- Excelente referencia para viagens agendadas e interurbanas em que afinidade e previsibilidade pesam mais.
- Gap: menor sensacao de operacao em tempo real comparada aos apps de ride-hailing.

### Conclusao de benchmark

- O mercado ja venceu a batalha de “pedir carro”.
- A MOVY precisa vencer em cinco frentes de UX:
  - confianca preventiva
  - preco explicavel
  - autonomia do motorista
  - controle auditavel da viagem
  - operacao hibrida urbana + interurbana sem confusao de interface

## 2. Proposta de experiencia da MOVY

### Tese central

A MOVY nao deve parecer “mais um app de corrida”. Ela deve parecer uma plataforma de mobilidade confiavel, legivel e justa.

### Principios de experiencia

- Clareza antes de velocidade: o usuario precisa entender o que esta comprando e com quem.
- Seguranca preventiva: o produto deve antecipar risco, nao apenas reagir ao incidente.
- Controle orientado por contexto: mostrar mais opcoes quando a decisao importa; simplificar quando nao importa.
- Transparencia operacional: mostrar preco, taxa, repasse, score e justificativas sem juridiquês.
- Interface de confianca: menos ruído, mais estado, mais previsibilidade.

### Promessa por persona

- Passageiro: “eu sei quanto vou pagar, quem vai me levar, como estou protegido e o que acontece em cada etapa”.
- Motorista: “eu entendo quanto vou ganhar, posso operar como negocio e nao sou refem de uma caixa-preta”.
- Admin/operacao: “eu vejo risco, liquidez, incidentes e performance em tempo real com rastreabilidade”.

## 3. Arquitetura frontend

### Estrutura recomendada

- `frontend/app/(marketing)` para posicionamento e aquisicao.
- `frontend/app/(passenger)` para cotacao, booking, corrida, historico, seguranca e suporte.
- `frontend/app/(driver)` para modo empresario, disponibilidade, ofertas, corrida, carteira e desempenho.
- `frontend/app/(admin)` para control tower, incidentes, antifraude, pagamentos e suporte.

### Camadas

- `app/`: rotas, layouts e composicao server-first.
- `features/`: modulos por dominio (`rides`, `pricing`, `safety`, `wallet`, `support`, `identity`).
- `components/`: componentes compartilhados puros.
- `lib/`: SDK da API, analytics, formatadores, politicas e helpers.
- `styles/`: tokens, temas, motion e contratos visuais.

### Decisoes tecnicas

- Priorizar Server Components para leitura e hydration seletiva para interacao critica.
- Ter um client data layer pequeno e especifico, nao um estado global descontrolado.
- Centralizar acesso a API em um SDK interno, evitando `fetch` espalhado.
- Feature flags no frontend para liberar fluxos sensiveis por publico e cidade.
- Logs e analytics de produto ja na camada de UI, com eventos nomeados por dominio.

### Riscos reduzidos por essa arquitetura

- Menor acoplamento entre telas e endpoints.
- Menos regressao visual ao escalar rotas.
- Facilidade para migrar de endpoints atuais para `/api/v1`.
- Melhor isolamento entre fluxo passageiro, fluxo motorista e fluxo operacional.

## 4. Design system

### Direcao visual

- A MOVY deve transmitir confianca operacional e energia de movimento.
- Visual mais “control tower + mobility network” do que “startup genérica”.
- Contraste alto, hierarquia forte, superficies premium e sinalizacao de risco bem definida.

### Tokens

- Cores:
  - base profunda para transmitir confianca
  - verde/teal para acao segura
  - amber para atencao operacional
  - vermelho reservado para risco/incidente
- Tipografia:
  - display expressivo para headlines
  - fonte altamente legivel para dashboards, listas e formularios
- Espacamento:
  - escala de 4/8/12/16/24/32/48
- Raios:
  - componentes interativos suaves, sem “caixas duras” demais

### Componentes-base

- `AppShell`
- `TopNav`
- `SideRail`
- `CommandBar`
- `SectionHeader`
- `MetricCard`
- `TripCard`
- `DriverCard`
- `FareBreakdownCard`
- `RiskBadge`
- `StatusPill`
- `SafetyCenter`
- `Timeline`
- `Drawer`
- `BottomActionBar`
- `EmptyState`
- `InlineAlert`
- `DataTable`
- `MapPanel`
- `TrustBadge`

### Regras de componente

- Todo componente critico deve ter variantes de loading, empty, error e success.
- Toda acao destrutiva ou irreversivel precisa de confirmacao contextual.
- Componentes de risco e seguranca nunca podem depender apenas de cor; precisam de texto e icone.

## 5. Sitemap

### Publico / marketing

- `/`
- `/seguranca`
- `/motoristas`
- `/cidades`
- `/empresas`
- `/ajuda`

### Passageiro

- `/app/passageiro`
- `/app/passageiro/nova-viagem`
- `/app/passageiro/estimativa`
- `/app/passageiro/viagem/[rideId]`
- `/app/passageiro/historico`
- `/app/passageiro/pagamentos`
- `/app/passageiro/seguranca`
- `/app/passageiro/suporte`
- `/app/passageiro/perfil`

### Motorista

- `/app/motorista`
- `/app/motorista/ofertas`
- `/app/motorista/viagem/[rideId]`
- `/app/motorista/ganhos`
- `/app/motorista/carteira`
- `/app/motorista/desempenho`
- `/app/motorista/agenda`
- `/app/motorista/seguranca`
- `/app/motorista/suporte`
- `/app/motorista/perfil`

### Admin

- `/app/admin`
- `/app/admin/live`
- `/app/admin/incidentes`
- `/app/admin/fraude`
- `/app/admin/usuarios`
- `/app/admin/motoristas`
- `/app/admin/pagamentos`
- `/app/admin/disputas`
- `/app/admin/analytics`
- `/app/admin/configuracoes`

## 6. Fluxos do passageiro, motorista e admin

### Passageiro

#### Fluxo principal

1. Abrir home com endereco inicial e atalhos.
2. Informar origem/destino.
3. Ver estimativa com breakdown e modos de escolha.
4. Escolher tipo de viagem e, quando aplicavel, opcao de motorista.
5. Confirmar pagamento e protecoes ativas.
6. Acompanhar chegada e validar embarque.
7. Durante a corrida, acessar centro de seguranca sem friccao.
8. Concluir, pagar, avaliar e abrir suporte se necessario.

#### Regras de UX

- Preco deve ser explicado antes da confirmacao.
- PIN e trusted contacts devem ficar acessiveis sem poluir a tela.
- Se houver risco elevado, a UI precisa explicar a validacao extra.

### Motorista

#### Fluxo principal

1. Entrar no painel diario.
2. Ligar disponibilidade e revisar meta/agenda.
3. Receber oferta com dados suficientes para decidir.
4. Aceitar e iniciar aproximacao.
5. Validar embarque.
6. Executar a viagem com suporte de rota, eventos e seguranca.
7. Concluir com visao de ganho liquido e impacto em meta.

#### Regras de UX

- A tela de oferta precisa mostrar ganho esperado, distancia ate pickup, score de risco e adequacao a preferencias.
- A tela de corrida deve priorizar a operacao, nao analytics.
- O painel financeiro precisa ser legivel como ferramenta de trabalho, nao como extrato bruto.

### Admin

#### Fluxo principal

1. Abrir control tower com KPIs e alertas.
2. Entrar em live operations ou incidentes.
3. Filtrar eventos por severidade, cidade, tipo de corrida e papel.
4. Acessar trilha completa da viagem.
5. Acionar protocolo, suporte, bloqueio, reembolso ou analise antifraude.
6. Auditar e encerrar com justificativa.

#### Regras de UX

- Operacao precisa ver o estado do sistema em menos de 10 segundos.
- Incidentes precisam ter leitura cronologica e evidencias.
- Toda acao operacional sensivel precisa expor impacto e auditoria.

## 7. Telas prioritarias

- Home passageiro
- Estimativa de viagem
- Escolha de opcao / motorista
- Viagem em andamento
- Centro de seguranca
- Painel diario do motorista
- Oferta de corrida
- Corrida do motorista
- Carteira / ganhos
- Dashboard admin
- Fila de incidentes
- Detalhe da viagem / disputa

## 8. Componentes e microcopy

### Microcopy desejada

- Explicar sem infantilizar.
- Evitar jargao interno.
- Deixar claro o porque de cada decisao do sistema.

### Exemplos

- “Preco estimado com base em distancia, tempo, demanda e regras da cidade.”
- “Seu PIN de embarque protege o inicio da viagem.”
- “Validacao extra ativada porque esta corrida exige mais seguranca.”
- “Ganho liquido previsto depois da taxa da plataforma.”

## 9. Acessibilidade

- WCAG 2.2 AA como baseline.
- Ordem de foco correta em todas as jornadas.
- Contraste forte em estados criticos.
- Rotulos explicitos em campos, botoes e componentes de mapa.
- Alertas e mudancas de estado anunciados para tecnologias assistivas.
- Alvos de toque amplos para uso em mobilidade real.

## 10. Performance

- Server rendering para leitura inicial rapida.
- Streaming em dashboards e paginas de dados.
- Lazy load de mapas, graficos e paineis secundarios.
- Skeletons informativos em vez de spinners vazios.
- Otimizacao de bundle por rota e por papel.
- Web vitals instrumentados por fluxo principal.

## 11. Analytics

### Eventos minimos

- `ride_estimate_viewed`
- `ride_estimate_confirmed`
- `ride_request_created`
- `driver_offer_viewed`
- `driver_offer_accepted`
- `pin_viewed`
- `pin_verified`
- `safety_center_opened`
- `sos_triggered`
- `support_ticket_created`
- `wallet_summary_viewed`
- `admin_incident_opened`

### KPIs de frontend

- tempo ate primeira estimativa
- conversao estimativa -> booking
- tempo de decisao do motorista
- uso de recursos de seguranca
- abandono por etapa
- friccao por validacao extra

## 12. Testes

- Unitarios para formatadores, mapeadores e regras de exibição.
- Integration/component tests para formularios, breakdown, safety center e tabelas operacionais.
- E2E por persona.
- Testes de acessibilidade automatizados.
- Testes visuais para componentes do design system.
- Testes de degradacao para falha de API, latencia e fallback.

## 13. Sequencia recomendada de execucao

1. Consolidar design tokens e shell de navegacao.
2. Separar rotas por papel.
3. Implementar fluxo passageiro de estimativa -> booking -> viagem.
4. Implementar modo empresario do motorista.
5. Implementar control tower admin e fila de incidentes.
6. Instrumentar analytics, feature flags, acessibilidade e testes.
