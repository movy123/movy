# MOVY Staging First Deploy Checklist

## Objetivo

Executar o primeiro deploy de staging da MOVY com o workflow [`deploy-staging`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/.github/workflows/deploy-staging.yml) usando a stack [`infra/docker-compose.staging.yml`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/infra/docker-compose.staging.yml).

## 1. Secrets obrigatorios no GitHub

Cadastre estes secrets no environment `staging` do repositório:

- `STAGING_APP_DIR`
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_SSH_PRIVATE_KEY`
- `STAGING_SSH_PORT`
- `STAGING_REGISTRY_USER`
- `STAGING_REGISTRY_TOKEN`
- `STAGING_JWT_SECRET`
- `STAGING_POSTGRES_DB`
- `STAGING_POSTGRES_USER`
- `STAGING_POSTGRES_PASSWORD`
- `STAGING_CORS_ALLOWED_ORIGINS`
- `STAGING_PUBLIC_API_URL`
- `STAGING_PUBLIC_WS_URL`
- `STAGING_FRONTEND_URL`
- `STAGING_ADMIN_EMAIL`
- `STAGING_ADMIN_PASSWORD`
- `STAGING_PASSENGER_EMAIL`
- `STAGING_PASSENGER_PASSWORD`
- `STAGING_DRIVER_EMAIL`
- `STAGING_DRIVER_PASSWORD`

## 2. Preparacao do host de staging

No host remoto:

1. Instale Docker e Docker Compose plugin.
2. Reserve a pasta de deploy.
3. Execute o bootstrap:

```bash
bash infra/scripts/bootstrap-staging.sh /srv/movy-staging
```

## 3. Regras de rede e acesso

- Abrir apenas as portas necessarias ao proxy e ao acesso operacional.
- Se houver proxy reverso, prefira expor somente 80/443 publicamente.
- Restringir SSH por IP ou VPN quando possivel.

## 4. Validacoes antes do primeiro deploy

- `develop` verde em CI.
- `npm run verify` e `npm run audit` passando.
- Dominio de staging definido.
- Certificado/TLS do proxy pronto ou plano equivalente.
- Credenciais demo de staging separadas das credenciais locais.

## 5. Primeiro deploy

1. Abra GitHub Actions.
2. Execute `deploy-staging` por `workflow_dispatch`.
3. Aguarde:
   - build
   - push de imagens
   - upload do bundle
   - deploy remoto
   - smoke pós-release

## 6. Validacao pos-deploy

- `GET /api/health`
- `GET /api/readiness`
- `GET /api/health` do frontend
- login com passageiro de staging
- criacao de estimativa de corrida
- overview admin

## 7. Rollback inicial

No host remoto:

```bash
cd /srv/movy-staging
ls -1 releases/.env.staging.*.bak | tail -n 1
cp releases/.env.staging.<timestamp>.bak .env.staging
docker compose --env-file .env.staging -f infra/docker-compose.staging.yml up -d --remove-orphans
```

## 8. Observacoes

- O workflow gera `.env.staging` dinamicamente a partir dos secrets.
- O arquivo local [`infra/env/staging.env.example`](C:/Users/cledi/Documents/SIST1/SISTE02/movy/infra/env/staging.env.example) serve como referencia, nao como fonte de secrets reais.
- Em staging real, prefira Postgres e Redis gerenciados quando a infraestrutura permitir.
