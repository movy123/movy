# MOVY Deploy Operating Model

## 1. Resumo executivo

MOVY tem base de aplicacao funcional e validada por `build`, `test` e `typecheck`, mas ainda nao esta pronta para deploy de producao sem reforco operacional. O principal risco nao esta no codigo compilar; esta na ausencia de artefatos de deploy de producao, pipeline CI/CD efetiva no local esperado do GitHub, gestao segura de segredos, observabilidade operacional, health checks de dependencia e plano automatizado de rollback.

A recomendacao atual e bloquear deploy em `production` ate que a plataforma tenha pipeline de promocao por ambiente, imagens versionadas, gestao de segredo fora do repositorio, readiness checks dependentes de banco/cache, dashboards minimos e runbook de incidente acionavel. Para o estado atual da MOVY, a estrategia sugerida e `blue-green` para backend/frontend com `feature flags` e rollout controlado de migracoes de banco em duas fases quando houver mudanca de schema sensivel.

## 2. Premissas adotadas

- O repositorio analisado e um monorepo com `backend`, `frontend`, `mobile`, `infra` e docs.
- O backend usa Fastify + TypeScript + Prisma + PostgreSQL, com fallback em memoria.
- O frontend usa Next.js 15.
- O mobile usa Expo e, por enquanto, entra como artefato validado em CI, nao como parte do deploy web principal.
- Postgres e Redis estao definidos apenas para ambiente simples/local em [`infra/docker-compose.yml`](/C:/Users/cledi/Documents/SIST1/SISTE02/movy/infra/docker-compose.yml).
- Existe um workflow em [`infra/ci.yml`](/C:/Users/cledi/Documents/SIST1/SISTE02/movy/infra/ci.yml), mas ele nao e executado automaticamente pelo GitHub Actions por estar fora de `.github/workflows/`.
- Em 28/03/2026, `npm run test`, `npm run build` e `npm run lint` passaram localmente.
- Nao foram encontrados Dockerfiles de backend/frontend/mobile nem IaC de producao.

## 3. Arquitetura de deploy sugerida

### Topologia alvo

- `frontend-web`: servico Next.js em modo standalone, exposto por reverse proxy TLS.
- `backend-api`: servico Fastify stateless, exposto apenas internamente ao proxy e aos componentes autorizados.
- `postgres`: banco gerenciado ou cluster dedicado com backup, PITR e replica de leitura quando o trafego justificar.
- `redis`: cache, rate limit, pub/sub realtime e fila leve.
- `object-storage`: bucket S3 compativel para uploads e anexos.
- `observability-stack`: logs centralizados, metricas, tracing e alertas.
- `secret-manager`: armazenamento de segredos por ambiente, nunca em `.env` commitado.

### Estrategia de empacotamento

- Empacotar backend e frontend como imagens Docker versionadas por commit SHA e versao semantica.
- Publicar artefatos imutaveis em registry privado.
- Manter o mobile fora do mesmo pipeline de deploy infra-web; promover binarios mobile em trilha separada.

### Estrategia de runtime

- `local` e `development`: Docker Compose.
- `staging`: preferencialmente Compose endurecido ou cluster pequeno com paridade de configuracao.
- `production`: Kubernetes quando houver demanda de escala/alta disponibilidade; se a equipe ainda nao operar K8s com maturidade, usar inicialmente VM/containers com blue-green controlado e reverse proxy.

### Estado real atual e lacunas bloqueantes

- Nao ha Dockerfiles nem imagens versionadas.
- O backend responde health da aplicacao, mas nao valida conectividade obrigatoria com Postgres/Redis no endpoint de saude.
- O Redis esta provisionado em Compose, mas nao esta integrado de forma operacional ao backend atual.
- O realtime usa `socket.io` in-process, sem estrategia de fan-out distribuido para multiplas replicas.
- O CORS esta aberto com `origin: true`, inadequado para producao.

## 4. Ambientes

### local

- Objetivo: desenvolvimento rapido, depuracao e testes manuais.
- Restricoes: pode usar `MOVY_DATA_MODE=memory`, dados descartaveis e segredos nao produtivos.
- Variaveis minimas: `BACKEND_PORT`, `JWT_SECRET`, `MOVY_DATA_MODE`, `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`.
- Servicos conectados: Postgres e Redis locais opcionais.
- Seguranca: segredos apenas locais; nunca reutilizar chaves reais.
- Observabilidade: logs de console e, no minimo, health local.
- Dados: seed de demo permitido.
- Promocao: nenhuma; local nao promove direto para producao.

### development

- Objetivo: integracao continua da equipe.
- Restricoes: proibido usar segredos hardcoded, proibido fallback silencioso para dependencias criticas sem alerta.
- Variaveis: mesmas de producao, com valores dev.
- Servicos: banco e redis dedicados de desenvolvimento.
- Seguranca: controle de acesso por equipe, TLS interno quando possivel.
- Observabilidade: logs estruturados, dashboard basico, alertas de erro alto.
- Dados: anonimizados ou sinteticos.
- Promocao: so promove para staging apos build, lint, testes e smoke tests.

### staging

- Objetivo: validacao pre-producao com alta paridade.
- Restricoes: configuracao deve ser o mais proxima possivel de producao.
- Variaveis: todas as de producao, com endpoints de homologacao.
- Servicos: Postgres, Redis, storage, auth integrations e notificacoes de homologacao.
- Seguranca: secrets manager, RBAC, TLS, CORS restritivo.
- Observabilidade: dashboards, tracing, alertas e retention minima.
- Dados: base sintetica ou mascarada; nunca usar dump irrestrito de producao.
- Promocao: exige migracao aplicada, smoke test e aprovacao explicita.

### production

- Objetivo: operacao real de negocio.
- Restricoes: deploy somente com change window, responsavel definido e rollback pronto.
- Variaveis: injetadas por secret manager e revisadas por checklist.
- Servicos: banco com backup e PITR, Redis gerenciado, proxy TLS, storage, observabilidade, notificacoes e seguranca ativa.
- Seguranca: least privilege, auditoria de deploy, MFA para acessos privilegiados.
- Observabilidade: dashboards SLO, alertas acionaveis, correlation id e logs estruturados.
- Dados: protecao LGPD, retencao definida e criptografia.
- Promocao: apenas a partir de staging aprovado.

## 5. Variaveis e segredos necessarios

### Variaveis obrigatorias por servico

#### backend-api

- `NODE_ENV`
- `BACKEND_PORT`
- `JWT_SECRET`
- `MOVY_DATA_MODE`
- `DATABASE_URL`
- `REDIS_URL`
- `CORS_ALLOWED_ORIGINS`
- `LOG_LEVEL`
- `APP_VERSION`
- `DEPLOY_ENV`

#### frontend-web

- `NODE_ENV`
- `PORT`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_ENV_NAME`
- `APP_VERSION`

#### mobile backend integration

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_WS_URL`
- `EXPO_PUBLIC_ENV_NAME`

### Segredos criticos

- `JWT_SECRET`
- credenciais de banco
- credenciais Redis quando gerenciado
- tokens de storage
- segredos de provedores de notificacao/pagamento/KYC quando entrarem em producao

### Achados de auditoria

- O arquivo [`.env.example`](/C:/Users/cledi/Documents/SIST1/SISTE02/movy/.env.example) contem segredos de demo e credenciais previsiveis; isso e aceitavel apenas para local, nunca para staging/producao.
- O backend usa fallback para `movy-local-secret` quando `JWT_SECRET` nao esta definido; em producao isso deve falhar na inicializacao.
- Nao ha segregacao documentada entre variaveis publicas (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) e segredos privados.

## 6. Pipeline CI/CD

### Pipeline alvo

1. `checkout`
   Objetivo: obter codigo e metadata de versao.
   Falha: ref invalida ou clone incompleto.
   Sucesso: workspace consistente.
   Logs: commit SHA, branch, tag.
   Artefatos: metadata de build.

2. `install`
   Objetivo: instalar dependencias via lockfile.
   Falha: lockfile quebrado, pacote ausente, registry indisponivel.
   Sucesso: dependencias restauradas sem drift.
   Logs: versao do Node, tempo de instalacao.
   Artefatos: cache de dependencias.

3. `lint`
   Objetivo: bloquear regressao basica de qualidade.
   Falha: erro de TypeScript/lint.
   Sucesso: todos os workspaces aprovados.
   Logs: saida completa.
   Artefatos: relatorio de validacao.

4. `test`
   Objetivo: validar fluxo minimo do backend.
   Falha: qualquer teste falhar.
   Sucesso: suite verde.
   Logs: resumo e detalhes de falhas.
   Artefatos: resultado de testes.

5. `build`
   Objetivo: garantir que os artefatos sejam geraveis.
   Falha: falha em `backend`, `frontend` ou `mobile`.
   Sucesso: build de todos os componentes.
   Logs: logs de compilacao.
   Artefatos: `backend/dist`, bundle do frontend, metadata mobile.

6. `security-and-config-scan`
   Objetivo: verificar segredos expostos, dependencias vulneraveis e politica de env.
   Falha: segredo detectado ou vulnerabilidade bloqueante.
   Sucesso: threshold aprovado.
   Logs: findings com severidade.
   Artefatos: SARIF ou relatorio equivalente.

7. `package-and-publish`
   Objetivo: construir e publicar imagens/artefatos imutaveis.
   Falha: Dockerfile ausente, erro de build/push.
   Sucesso: imagens tagueadas com SHA e versao.
   Logs: tags publicadas.
   Artefatos: imagens em registry.

8. `deploy-staging`
   Objetivo: promover release para homologacao.
   Falha: migracao falha, health check falha ou smoke test falha.
   Sucesso: staging em versao candidata.
   Logs: plano executado, recursos alterados.
   Artefatos: release manifest.

9. `smoke-tests`
   Objetivo: validar rotas e jornadas criticas.
   Falha: qualquer endpoint/jornada critica indisponivel.
   Sucesso: sinais vitais estaveis.
   Logs: respostas e tempos.
   Artefatos: relatorio de smoke.

10. `manual-approval-production`
    Objetivo: garantir gate humano auditable.
    Falha: aprovacao negada ou expiracao da janela.
    Sucesso: aprovacao com responsavel registrado.
    Logs: aprovador e horario.
    Artefatos: registro de aprovacao.

11. `deploy-production`
    Objetivo: promover a versao aprovada.
    Falha: health, readiness, erro elevado ou rollback trigger.
    Sucesso: versao ativa em producao.
    Logs: passos executados e versao anterior/atual.
    Artefatos: release record.

12. `post-deploy-verification`
    Objetivo: validar operacao real apos deploy.
    Falha: SLO degradado, smoke falho, dependencia critica indisponivel.
    Sucesso: sistema saudavel.
    Logs: metricas e verificacoes.
    Artefatos: evidencias de release.

### Implementacao entregue agora

- Foi criado um workflow executavel em [`.github/workflows/ci.yml`](/C:/Users/cledi/Documents/SIST1/SISTE02/movy/.github/workflows/ci.yml) para `install`, `lint`, `test` e `build`.
- O pipeline de CD para staging/producao permanece bloqueado ate existirem Dockerfiles, estrategia de deploy de runtime e segredos por ambiente.

## 7. Estrategia de deploy

### Recomendacao principal

Usar `blue-green deploy` para `backend-api` e `frontend-web`, combinado com `feature flags` para ativacoes sensiveis e rollout em duas fases para mudancas de banco.

### Por que usar

- O backend atual ainda nao tem fan-out realtime distribuido nem readiness profundo; blue-green reduz risco ao permitir troca controlada de trafego.
- O frontend em Next.js se beneficia de artefato versionado e troca atomica.
- O rollback operacional fica mais simples ao manter a versao anterior pronta.

### Riscos

- Custo maior de infraestrutura durante a troca.
- Necessidade de sincronizacao entre versao da aplicacao e schema.
- Sessoes realtime podem ser interrompidas se nao houver adaptador Redis.

### Mitigacao

- Fazer migracoes backward-compatible antes da troca de trafego.
- Introduzir feature flags para recursos novos.
- Manter TTL curto e reconexao automatica em WebSocket.
- Promover primeiro em staging com smoke completo.

### Impacto em usuario

- Indisponibilidade minima ou nula para web/API.
- Possivel reconexao curta em realtime durante corte.

### Impacto em custo

- Ambiente duplicado durante a janela de release.

### Casos alternativos

- `rolling deploy`: aceitavel apenas quando o backend tiver readiness confiavel, Redis adapter para realtime e compatibilidade plena entre replicas.
- `canary`: recomendado em fase posterior, quando houver telemetria madura por cohort e roteamento parcial.
- `manutencao controlada`: apenas para migracoes irreversiveis e alteracoes estruturais de alto risco.

## 8. Estrategia de rollback

### Gatilhos de rollback

- health check falho apos deploy
- erro 5xx acima do baseline
- aumento anormal de latencia
- falha em auth/login
- falha em endpoints criticos de rides/payments/support
- falha em conexao com Postgres/Redis/storage
- regressao funcional em smoke test

### Condicoes de bloqueio de deploy

- migracao sem plano de reversao ou compatibilidade backward
- ausencia de backup antes de mudanca critica
- observabilidade indisponivel
- variaveis/segredos incompletos
- CORS/seguranca em configuracao insegura

### Rollback de aplicacao

- Reverter o roteamento do proxy/load balancer para a versao verde anterior.
- Invalidar apenas os pods/containers da versao nova.
- Confirmar health da versao anterior antes de encerrar incidente.

### Rollback de infraestrutura

- Reaplicar manifest/compose anterior versionado.
- Reverter alteracoes de configuracao de ingress/proxy.

### Rollback de banco

- Preferir migracoes expansivas e contracts posteriores.
- Se a migracao for reversivel, executar `down` versionado.
- Se for irreversivel, restaurar por backup/PITR apenas sob decisao formal do incidente commander.

### Contingencia para migracao irreversivel

- Split release em duas fases: primeiro schema compativel, depois codigo.
- So remover colunas/constraints em release posterior quando nao houver mais trafego na versao antiga.

### Responsaveis

- Release owner
- Engenheiro de plataforma
- Responsavel de banco
- On-call de aplicacao

### Validacao pos-rollback

- health global
- login admin/passageiro/motorista
- consulta de overview
- criacao de corrida em smoke
- erros e latencia retornando ao baseline

## 9. Checklist pre-deploy

### Codigo e build

- [ ] branch/tag correta aprovada
- [ ] changelog ou release notes revisadas
- [ ] `npm ci` sem drift
- [ ] `npm run lint` aprovado
- [ ] `npm run test` aprovado
- [ ] `npm run build` aprovado
- [ ] lockfile atualizado
- [ ] versao e SHA da release definidos

### Configuracao

- [ ] segredos carregados por ambiente
- [ ] `JWT_SECRET` sem fallback local
- [ ] `DATABASE_URL` e `REDIS_URL` validados
- [ ] `CORS_ALLOWED_ORIGINS` restrito
- [ ] URLs publicas corretas para frontend/mobile
- [ ] reverse proxy e TLS configurados

### Banco de dados

- [ ] migracoes revisadas por engenharia e DRE
- [ ] backup ou snapshot criado
- [ ] tempo estimado da migracao conhecido
- [ ] compatibilidade app-schema validada em staging
- [ ] plano de reversao documentado

### Seguranca

- [ ] segredos fora do repositorio
- [ ] acessos minimos conferidos
- [ ] portas expostas revisadas
- [ ] logs sem dados sensiveis
- [ ] auditoria de quem aprovou o deploy habilitada

### Infraestrutura

- [ ] imagens/tag artefatos publicadas
- [ ] CPU/memoria definidos
- [ ] readiness/liveness configurados
- [ ] estrategia de deploy selecionada
- [ ] rollback pronto e testado

### Observabilidade

- [ ] dashboard da release aberto
- [ ] alertas criticos habilitados
- [ ] correlation id presente
- [ ] logs estruturados acessiveis

## 10. Checklist pos-deploy

- [ ] `/api/health` e `/api/v1/health` respondem 200
- [ ] frontend carrega e aponta para API correta
- [ ] login de admin funciona
- [ ] login de passageiro funciona
- [ ] login de motorista funciona
- [ ] `overview` responde para admin
- [ ] criacao de corrida funciona
- [ ] match/accept/start/complete funcionam em smoke controlado
- [ ] banco e redis respondem com latencia esperada
- [ ] websocket/realtime reconecta sem erro anormal
- [ ] logs sem explosao de erro
- [ ] CPU, memoria e conexoes estaveis
- [ ] alertas silenciosos revisados

## 11. Politica de migracao

- Toda migracao deve ser pequena, revisada e testada em staging.
- Preferir migracao expansiva: adicionar antes de remover.
- Evitar lock longo em tabelas quentes como `Ride`, `RideEvent` e `Payment`.
- Toda mudanca com risco de lock deve trazer estimativa de execucao.
- Toda migracao deve documentar impacto, compatibilidade e estrategia de rollback.
- Mudar colunas usadas por codigo em duas fases quando necessario.
- Seed de demo nunca deve rodar em producao.

### Achados atuais

- Existe somente a migracao inicial em [`backend/prisma/migrations/0001_init/migration.sql`](/C:/Users/cledi/Documents/SIST1/SISTE02/movy/backend/prisma/migrations/0001_init/migration.sql).
- O backend pode cair para modo `memory` se o banco falhar; em producao isso mascara falha critica e deve ser proibido.

## 12. Observabilidade

### Minimo obrigatorio

- logs JSON estruturados
- `request_id` e `correlation_id`
- metricas HTTP: throughput, latencia, taxa de erro
- metricas de negocio: corridas criadas, corridas concluidas, pagamentos liquidados, tickets de suporte
- metricas de dependencia: Postgres, Redis, storage
- tracing para auth, rides, payments e support
- dashboard por release
- alertas: 5xx, latencia, falha de auth, falha de banco/cache, erro de websocket

### Estado atual e gaps

- O Fastify esta com `logger: false`, portanto o backend ainda nao produz logging operacional adequado.
- O health atual nao verifica dependencias.
- Nao ha instrumentacao de Prometheus/OpenTelemetry no repositorio.
- Nao ha dashboards ou alertas versionados.

## 13. Riscos

- Deploy para producao sem Dockerfiles e sem artefato versionado.
- Pipeline CI existente fora do caminho padrao do GitHub Actions.
- Segredo JWT com fallback local.
- CORS permissivo demais para producao.
- Fallback silencioso para persistencia em memoria.
- Ausencia de readiness/liveness dependentes de banco/cache.
- Realtime sem estrategia multi-replica.
- Observabilidade praticamente inexistente.
- Redis provisionado, mas ainda nao integrado como dependencia operativa.

## 14. Mitigacao

- Bloquear producao ate empacotamento via Docker e publicacao de imagens.
- Ativar CI real em `.github/workflows`.
- Falhar startup em `production` se segredo ou dependencia critica nao estiverem presentes.
- Restringir CORS por lista de origens.
- Desabilitar fallback para `memory` fora de `local`.
- Adicionar health/readiness separados para aplicacao e dependencias.
- Introduzir Redis adapter para websocket quando houver replicas.
- Habilitar logs estruturados, metricas e alertas antes do primeiro go-live.

## 15. Runbook

### Objetivo do deploy

Promover uma versao validada da MOVY para o ambiente alvo com risco controlado, observabilidade ativa e rollback rapido.

### Escopo

- backend API
- frontend web
- migracoes Prisma quando aprovadas
- configuracao por ambiente

### Servicos afetados

- `backend`
- `frontend`
- `postgres`
- `redis`
- proxy/reverse proxy

### Pre-requisitos

- release aprovada
- backup confirmado
- pipeline verde
- segredos carregados
- responsaveis em prontidao

### Passos operacionais

1. Confirmar janela de release, SHA e responsaveis.
2. Validar checklist pre-deploy.
3. Executar migracao compativel em staging e rodar smoke.
4. Publicar artefatos/imagens da release.
5. Preparar ambiente azul da nova versao.
6. Executar migracoes de producao, quando aprovadas.
7. Subir backend/frontend na nova cor sem trocar trafego.
8. Executar health, readiness e smoke internos.
9. Trocar trafego gradualmente para a nova cor.
10. Monitorar 15 a 30 minutos com dashboard aberto.
11. Encerrar release apenas apos checklist pos-deploy completo.

### Rollback operacional

1. Acionar gatilho de rollback.
2. Reverter trafego para a versao anterior.
3. Congelar novas mudancas.
4. Validar saude da versao restaurada.
5. Abrir incidente e registrar causa/evidencias.

### Responsaveis

- release owner
- owner de backend
- owner de frontend
- owner de banco
- on-call operacional

### Janela recomendada

- Preferir horario de menor trafego e com equipe completa disponivel.
- Evitar deploy em periodos sem cobertura de resposta.

### Observacoes operacionais

- Se houver migracao irreversivel, o deploy deve ser manual, assistido e com criterio de abortar antes do corte de trafego.
- Se o realtime estiver distribuido entre replicas, o adaptador Redis passa a ser requisito de deploy.

## 16. Proxima acao recomendada

Executar em ordem:

1. Criar Dockerfiles de `backend` e `frontend`, com imagens versionadas e health checks.
2. Endurecer o backend para producao: remover fallback inseguro, restringir CORS, ativar logs estruturados e readiness de dependencias.
3. Definir segredos por ambiente e publicar workflow de CI/CD com promocao `staging -> production`.
4. Implantar observabilidade minima antes do primeiro deploy produtivo.
