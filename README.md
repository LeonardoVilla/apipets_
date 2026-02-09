# Gerenciador de Pets

Projeto Vite + API serverless com Swagger UI.

## Variaveis de ambiente

Use o arquivo `.env.example` como base para criar seu `.env` local.

Defina estas variaveis no Vercel (e localmente se for usar `vercel dev`):

- `BLOB_READ_WRITE_TOKEN`
- `JWT_SECRET`

## Rotas importantes

- `/docs` - Swagger UI
- `/openapi` - OpenAPI YAML
- `/autenticacao/login`
- `/autenticacao/refresh`
- `/v1/pets`
- `/v1/tutores`

## Executar localmente

1. `npm install`
2. `npm run dev`

## Executar com Docker

1. Copie `.env.example` para `.env` e preencha as variaveis.
2. `docker compose up --build`
3. Acesse `http://localhost:5173`

Nota: o Dockerfile usa cache do npm via BuildKit. Se estiver usando Docker antigo, ative com `DOCKER_BUILDKIT=1`.

## Docker (preview/prod)

Para rodar o build com o preview do Vite, execute:

1. `npm install`
2. `npm run build`
3. `npm run preview -- --host 0.0.0.0 --port 4173`

Com Docker:

1. `docker compose -f docker-compose.preview.yml up --build`
2. Acesse `http://localhost:4173`

Esse compose usa o `Dockerfile.preview` (multi-stage).
# apipets_
