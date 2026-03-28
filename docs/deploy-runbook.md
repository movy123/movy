# MOVY Deploy, Release and Reliability Runbook

## 1. Resumo executivo

MOVY ainda nao esta pronta para um deploy de producao sem endurecimento adicional de seguranca, operacao e governanca. O repositorio ja possui build, testes de backend, imagens Docker e modo `memory` para fallback local, mas ainda faltam camadas obrigatorias para producao: pipeline de deploy com promocao entre ambientes, secrets manager, backup/restore validado, logs estruturados, correlation id, rate limiting, reverse proxy com TLS, health/readiness completos por servico, observabilidade centralizada e estrategia operacional para migracoes Prisma.

Como base de release, a recomendacao para MOVY e:

- `local` e `development`: Docker Compose
- `staging`: ambiente espelho simplificado de producao com Postgres e Redis gerenciados
- `production`: deploy blue-green por imagem versionada para `frontend` e `backend`, com banco PostgreSQL gerenciado, Redis gerenciado, CDN/WAF na borda e rollback por troca de target group ou roteamento

## 2. Premissas adotadas

- O monorepo atual continua sendo a unidade de mudanca.
- O backend Fastify e o frontend Next.js serao empacotados em imagens separadas.
- O mobile nao entra no mesmo ciclo de deploy web, mas depende do backend e das mesmas variaveis publicas.
- PostgreSQL e Redis devem existir como servicos externos gerenciados em staging e production.
- `MOVY_DATA_MODE=memory` e aceitavel apenas para local e smoke tests de container.
- O deploy de producao precisa ser aprovado manualmente apos staging e smoke tests.
- O objetivo e minimizar indisponibilidade e manter rollback rapido.

## 3. Arquitetura de deploy sugerida

### 3.1 Topologia recomendada

- CDN/WAF na frente do frontend
- Reverse proxy ou load balancer com TLS
- `frontend` em container separado
- `backend` em container separado
- PostgreSQL gerenciado com backup automatizado e snapshots
- Redis gerenciado para cache, sessao efemera, fan-out e futuras filas
- Storage de objetos para uploads e evidencias operacionais
- Observabilidade centralizada para logs, metricas e alertas

### 3.2 Estrategia recomendada por componente

- `frontend`: blue-green ou rolling com invalidaçao controlada de cache
- `backend`: blue-green preferencial; rolling apenas quando houver compatibilidade reversa comprovada
- `database`: expand and contract, com migracoes pequenas e compatibilidade entre versoes
- `realtime/WebSocket`: sticky sessions ou adapter Redis quando houver multiplas replicas

### 3.3 Por que blue-green

- Reduz indisponibilidade percebida
- Facilita rollback rapido por troca de roteamento
- Evita substituir todas as instancias em cima de uma release defeituosa
- Permite validar health e smoke tests antes de receber trafego real

### 3.4 Achados atuais do repositorio

- Existe apenas Compose para Postgres e Redis local em [`infra/docker-compose.yml`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/infra/docker-compose.yml)
- O CI anterior era apenas um arquivo fora de `.github/workflows`, sem deploy real
- O backend usa `origin: true` em CORS em [`backend/src/app.ts`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/backend/src/app.ts), o que e inadequado para producao
- O backend esta com `logger: false` em [`backend/src/app.ts`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/backend/src/app.ts), sem logs estruturados
- Nao ha rate limiting, correlation id, WAF, TLS ou secrets manager versionados no repositorio
- Nao havia endpoint de health para frontend; agora existe em [`frontend/app/api/health/route.ts`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/frontend/app/api/health/route.ts)

## 4. Ambientes

### 4.1 Local

- Objetivo: desenvolvimento rapido e reproducao de bugs
- Banco: opcional via Compose, ou `memory`
- Redis: opcional
- Seguranca: segredos locais, sem exposicao publica
- Observabilidade: logs locais e smoke manual
- Promocao: nenhuma

### 4.2 Development

- Objetivo: integracao continua e validacao compartilhada
- Banco: Postgres dedicado nao produtivo
- Redis: dedicado nao produtivo
- Seguranca: secrets em cofre, IAM minimo
- Observabilidade: logs centralizados basicos e alertas de erro
- Promocao: merge aprovado e pipeline verde

### 4.3 Staging

- Objetivo: rehearsal realista de producao
- Banco: estrutura espelhada de producao com dados anonimizados
- Redis: espelhado
- Seguranca: TLS real, dominios reais de staging, acessos restritos
- Observabilidade: dashboards, alertas e tracing habilitados
- Promocao: build assinado, migracao testada e smoke completo
- Referencia de stack no repositorio: `infra/docker-compose.staging.yml`
- Arquivo de configuracao base: `infra/env/staging.env.example`

### 4.4 Production

- Objetivo: atender usuarios com alta disponibilidade
- Banco: PostgreSQL gerenciado com backup continuo
- Redis: gerenciado com alta disponibilidade proporcional a carga
- Seguranca: WAF, TLS, IAM minimo, trilha de auditoria
- Observabilidade: logs, metricas, alertas, SLOs e incident response
- Promocao: somente a partir de staging validado e aprovacao manual

## 5. Variaveis e segredos necessarios

### 5.1 Comuns

- `NODE_ENV`
- `BACKEND_PORT`
- `NEXT_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_URL`
- `MOVY_DATA_MODE`

### 5.2 Backend

- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `MOVY_DEMO_ADMIN_EMAIL`
- `MOVY_DEMO_ADMIN_PASSWORD`
- `CORS_ALLOWED_ORIGINS`
- `LOG_LEVEL`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW_MS`
- `SENTRY_DSN` ou equivalente
- `OTEL_EXPORTER_OTLP_ENDPOINT` ou equivalente

### 5.3 Infra/seguranca

- credenciais do registry
- segredos do provedor cloud
- chave de deploy ou identidade federada do CI
- certificados ou referencia ao terminador TLS
- credenciais de backup/restore e storage

### 5.4 Regras

- segredos nunca no repositorio
- usar secret manager por ambiente
- rotacionar `JWT_SECRET` com plano de impacto
- diferenciar claramente variaveis publicas e privadas

## 6. Pipeline CI/CD

### 6.1 Pipeline implementada no repositorio

Existe agora uma pipeline real em [` .github/workflows/ci.yml`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/.github/workflows/ci.yml) com:

- checkout
- install via `npm ci`
- lint/typecheck
- testes
- build
- `npm audit`
- build das imagens Docker
- smoke test de containers para backend e frontend

### 6.2 Pipeline alvo para staging e producao

1. Checkout
   Sucesso: codigo correto e tag/commit resolvidos
   Falha: branch errada, ref inexistente, checkout incompleto

2. Install
   Sucesso: lockfile respeitado
   Falha: dependencia quebrada, integridade comprometida

3. Lint/typecheck
   Sucesso: sem erro bloqueante
   Falha: regressao estrutural

4. Testes
   Sucesso: suites minimas verdes
   Falha: regressao funcional

5. Build
   Sucesso: artefatos consistentes
   Falha: release invalida

6. Security scan
   Sucesso: sem vulnerabilidade critica sem excecao aprovada
   Falha: bloquear promocao

7. Container smoke
   Sucesso: imagem sobe e responde health
   Falha: Dockerfile ou runtime invalido

8. Push de imagem
   Sucesso: artefatos publicados com tag imutavel
   Falha: impossivel promover

9. Deploy em staging
   Sucesso: release criada sem substituir producao
   Falha: bloquear producao

10. Smoke tests em staging
   Sucesso: health, auth e jornada critica ok
   Falha: rollback em staging e bloqueio de promocao

11. Aprovacao manual
   Sucesso: change review e janela operacional confirmadas
   Falha: sem deploy

12. Deploy em producao
   Sucesso: trafego migrado de forma controlada
   Falha: rollback automatico ou assistido

13. Verificacao pos-deploy
   Sucesso: metricas, logs e smoke normais
   Falha: rollback

## 7. Estrategia de deploy

### 7.1 Development

- rolling simples
- baixo custo
- rollback por reaplicacao da ultima imagem

### 7.2 Staging

- blue-green simplificado
- validacao obrigatoria de migracao e smoke
- dados anonimizados

### 7.3 Production

- blue-green para backend e frontend
- database first only when backward compatible
- feature flags para capacidades de risco maior
- trafego movido apenas apos health, smoke e observabilidade inicial ok

### 7.4 Riscos e mitigacoes

- migracao quebrar versao anterior
  Mitigacao: expand and contract e deploy em duas fases

- backend novo com websocket incompatível
  Mitigacao: compatibilidade de contrato e Redis adapter antes de escalar horizontalmente

- frontend apontar para backend errado
  Mitigacao: validacao explicita de `NEXT_PUBLIC_API_URL` por ambiente

- regressao silenciosa em auth
  Mitigacao: smoke autenticado obrigatorio em staging

## 8. Estrategia de rollback

### 8.1 Gatilhos

- health check falhando apos promocao
- explosao de 5xx
- latencia acima do erro budget
- falha em login, criacao de corrida ou fluxo admin
- erro de migracao ou saturacao anormal

### 8.2 Rollback de aplicacao

- manter sempre a imagem anterior marcada como `last-known-good`
- trocar target group/roteamento para o conjunto antigo
- invalidar cache apenas se necessario
- reexecutar smoke apos retorno

### 8.3 Rollback de infraestrutura

- reaplicar a definicao anterior da stack
- restaurar configuracao de proxy, secrets e autoscaling do release anterior

### 8.4 Banco de dados

- preferir migracoes reversiveis
- se irreversivel, usar estrategia expand and contract
- backup/snapshot antes de migracoes destrutivas
- rollback de dados apenas com runbook especifico e aprovacao operacional

### 8.5 Validacao pos-rollback

- backend e frontend respondendo health
- login admin e endpoint critico funcionando
- erros estabilizados
- metricas voltando a baseline

## 9. Checklist pre-deploy

- branch/tag correta e changelog do release fechado
- `npm ci`, `npm run lint`, `npm test`, `npm run build` e `npm run audit` verdes
- smoke Docker verde
- imagens versionadas e imutaveis publicadas
- variaveis por ambiente revisadas
- segredos carregados a partir de secret manager
- dominios, CORS e TLS revisados
- `DATABASE_URL` e `REDIS_URL` validados no ambiente alvo
- backup/snapshot agendado antes de migracoes sensiveis
- migracoes Prisma revisadas e testadas em staging
- capacidade minima de CPU/memoria confirmada
- health checks, readiness e restart policy definidos
- dashboard e alertas operacionais carregados
- responsaveis e janela de deploy confirmados
- plano de rollback comunicado

## 10. Checklist pos-deploy

- backend responde [`/api/health`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/backend/src/app.ts)
- frontend responde [`/api/health`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/frontend/app/api/health/route.ts)
- login admin e fluxo autenticado critico funcionando
- APIs de rides, payments e support respondem
- banco e cache conectados
- realtime operacional
- logs sem pico de erro
- latencia e uso de recursos dentro do baseline
- dashboards e alertas recebendo dados
- smoke tests e jornada critica executados
- nenhuma fila atrasada ou integracao degradada

## 11. Politica de migracao

- toda migracao deve passar por staging
- evitar DDL destrutivo no mesmo release da remocao de codigo antigo
- adicionar campos novos como opcionais primeiro
- backfill assíncrono quando o volume justificar
- remover colunas apenas em release posterior
- medir lock e tempo de execucao antes de producao
- ter backup valido antes de mudancas de schema de alto risco

## 12. Observabilidade

### 12.1 Obrigatorio antes de producao

- logs JSON estruturados
- correlation id por request
- metricas de `request count`, `error rate`, `latency p50/p95/p99`
- metricas de Postgres e Redis
- dashboard de health de frontend, backend, banco e cache
- alertas para 5xx, indisponibilidade, latencia, falha de deploy e falha de integracoes

### 12.2 Lacunas atuais

- sem tracing
- sem alertas versionados no repositorio
- sem dashboard operacional definido
- endpoint de metricas ainda e JSON operacional basico; faltam exporters dedicados

## 13. Riscos principais

- deploy de producao sem secrets manager
- CORS permissivo demais no backend
- ausencia de rate limiting e protecoes HTTP adicionais
- ausencia de backup/restore operacional comprovado
- pipeline ainda nao faz deploy real em staging/producao
- mobile depende do backend, mas nao ha politica formal de compatibilidade de API
- Redis ainda nao esta integrado ao realtime escalavel

## 14. Mitigacao recomendada

- adicionar configuracao estrita de CORS por ambiente
- incluir `helmet`, rate limit e correlation id no backend
- centralizar logs e alertas antes de expor publicamente
- definir e testar backup/restore do Postgres
- provisionar staging completo antes de qualquer producao
- introduzir deploy blue-green com aprovacao manual
- documentar contratos minimos de compatibilidade entre app mobile e API

## 15. Runbook operacional

### 15.1 Objetivo

Publicar uma nova versao do MOVY com risco controlado, validacao completa e rollback rapido.

### 15.2 Escopo

- frontend web
- backend API
- banco PostgreSQL
- Redis
- proxy/TLS
- observabilidade associada

### 15.3 Pre-requisitos

- pipeline verde
- imagens publicadas
- secrets carregados
- migracoes aprovadas
- responsaveis online
- janela operacional aberta

### 15.4 Passos

1. Confirmar versao, changelog, incidentes abertos e janela de deploy.
2. Executar checklist pre-deploy.
3. Aplicar migracoes compativeis com backward compatibility.
4. Subir stack green em staging ou slot de producao sem trafego.
5. Executar smoke test de backend, frontend e auth.
6. Verificar logs, metricas e conexoes de banco/cache.
7. Mover trafego gradualmente ou trocar blue para green.
8. Executar checklist pos-deploy.
9. Manter observacao intensiva por pelo menos 30 minutos.

### 15.5 Rollback

1. Interromper promocao ao primeiro sinal de regressao severa.
2. Reapontar trafego para a versao blue anterior.
3. Se necessario, restaurar configuracao anterior da stack.
4. Se migracao foi incompatível, seguir runbook especifico de restore.
5. Executar smoke e revisar metricas apos rollback.

### 15.6 Responsaveis

- Release Manager: coordena janela e aprovacoes
- DevOps/SRE: executa promocao e rollback
- Backend owner: valida APIs, migracoes e auth
- Frontend owner: valida web app e integraçao com API
- DBA/Platform: valida Postgres, backup e restore

### 15.7 Janela recomendada

- staging: qualquer horario comercial
- producao: janela de baixo trafego com equipe de plantao disponivel

## 16. Proxima acao recomendada

Antes de qualquer producao, executar esta ordem:

1. provisionar staging com Postgres/Redis gerenciados ou usar `infra/docker-compose.staging.yml` como baseline transitório
2. criar `infra/env/staging.env` a partir de `infra/env/staging.env.example` com secrets reais fora do repositório
3. adicionar deploy blue-green real ao provedor escolhido
4. testar migracao Prisma e rollback em staging
5. conectar logs/metricas a stack centralizada e definir dashboards e alertas minimos

## 17. Sinais operacionais minimos

- Health: `GET /api/health`
- Readiness: `GET /api/readiness`
- Metrics operacionais autenticadas: `GET /api/v1/metrics`
- Correlation id: cabecalho `x-request-id`
- Logs esperados por request:
  - `request started`
  - `request completed`
  - `request failed` ou `unhandled request error`

## 18. Alertas minimos recomendados

- health degradado por mais de 2 minutos
- readiness fora de `ready` em staging/producao
- taxa de 5xx acima do baseline
- latencia p95 acima do SLO definido
- falha de conexao em Postgres ou Redis
- crescimento de incidentes de seguranca, fraude ou safety no overview admin
