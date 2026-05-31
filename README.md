# Star Wars Explorer

Aplicação Angular 17 standalone com duas telas — listagem de personagens e filmes do universo Star Wars — consumindo a [SWAPI REST API](https://swapi.dev) pública, com interface em Angular Material e otimizada para Core Web Vitals.

## Funcionalidades

- **Personagens**: lista paginada (10 por página, ~82 total) com nome, ano de nascimento, gênero, altura e massa
- **Filmes**: grade de cards com todos os filmes (~6), mostrando episódio, título, diretor e data de lançamento
- Navegação entre as duas telas via barra de ferramentas persistente
- Indicador visual do link ativo
- Estado de erro em português com opção de retry
- Cache em memória dos filmes (sem requisição duplicada ao navegar)

## Pré-requisitos

| Ferramenta | Versão |
|------------|--------|
| Node.js | ≥ 18.13 |
| npm | ≥ 9 |
| Angular CLI | 17.x (`npm install -g @angular/cli@17`) |

## Instalação

```bash
git clone https://github.com/dudscode/frontend-starwars-datadog.git
cd frontend-starwars-datadog
npm install
```

## Comandos

### Executar localmente

```bash
ng serve
# Abrir: http://localhost:4200
```

### Testes unitários (JEST)

```bash
# Executar testes
npm test

# Executar com relatório de cobertura (meta: 100%)
npx jest --coverage
```

### Testes E2E (Playwright)

```bash
# O servidor deve estar rodando em outro terminal: ng serve
npx playwright test

# Com interface visual do browser
npx playwright test --headed

# Arquivo específico
npx playwright test e2e/tests/characters.e2e.spec.ts
```

### Build de produção

```bash
ng build
# Saída: dist/starwars-explorer/
```

## Configuração de ambiente

| Variável | Arquivo | Padrão | Descrição |
|----------|---------|--------|-----------|
| `apiUrl` | `src/environments/environment.ts` | `https://swapi.dev/api` | URL base da SWAPI |

Para usar uma instância alternativa da API, edite `src/environments/environment.ts`:

```typescript
export const environment = {
  apiUrl: 'https://swapi.py4e.com/api', // instância alternativa
};
```

## Metas de Core Web Vitals

| Métrica | Meta |
|---------|------|
| LCP (Largest Contentful Paint) | ≤ 2,5 s |
| CLS (Cumulative Layout Shift) | ≤ 0,1 |
| INP (Interaction to Next Paint) | ≤ 200 ms |

Verificar com Lighthouse: DevTools → Lighthouse → Mobile → Analyze page load em `http://localhost:4200`.

## Observabilidade (Datadog Logs)

A aplicação captura automaticamente eventos estruturados via `window.DD_LOGS` (Datadog Logs SDK, inicializado externamente pelo infrastructure team):

| Evento | Trigger | Campos |
|--------|---------|--------|
| `render_complete` | Tela carregada ≤ 5 s | `view_name`, `duration_ms`, `threshold_exceeded: false` |
| `latency` | Tela carregada > 5 s | `view_name`, `duration_ms`, `threshold_exceeded: true` |
| `request_error` | Falha HTTP | `http_status`, `endpoint`, `error_message` |
| `js_error` | Erro Angular / promise rejeitada | `error_message` |

Todos os eventos carregam automaticamente `app_version` e `deploy_type` (contexto global — configurado pelo CI).

### Testar localmente com mock

```javascript
// Cole no console do browser antes de navegar:
window.DD_LOGS = {
  setGlobalContextProperty: (k, v) => console.log('[DD] global:', k, v),
  logger: { log: (msg, ctx, lvl) => console.log(`[DD][${lvl}] ${msg}`, ctx) }
};
```

### Variáveis de CI

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `APP_VERSION` | `abc1234` | SHA do commit deployado |
| `DEPLOY_TYPE` | `canary` ou `stable` | Slot do deploy |

```bash
ng build \
  --define "__APP_VERSION__=\"${APP_VERSION}\"" \
  --define "__DEPLOY_TYPE__=\"${DEPLOY_TYPE}\""
```

## Arquitetura

```
src/app/
├── app.component.ts          # Shell — toolbar + router-outlet
├── app.routes.ts             # Rotas lazy-loaded
├── app.config.ts             # Providers (router, http, animations, observability)
├── features/
│   ├── characters/           # Tela de personagens
│   └── films/                # Tela de filmes
├── core/
│   ├── services/
│   │   ├── swapi.service.ts          # Único ponto de acesso à API
│   │   └── observability.service.ts  # Facade DD_LOGS — watchView, log
│   ├── interceptors/
│   │   └── dd-logs.interceptor.ts    # Captura erros HTTP
│   ├── handlers/
│   │   └── global-error.handler.ts   # Captura erros JS / promises
│   └── types/
│       └── dd-logs.types.ts          # LogPayload, EventType, Severity
└── models/                   # Interfaces TypeScript (Character, Film, SwapiList)
```

## Tecnologias

- **Angular 17** (standalone, sem NgModule)
- **Angular Material 17** (Indigo/Pink)
- **RxJS 7** (observables, `switchMap`, `shareReplay`)
- **JEST** + `jest-preset-angular` (testes unitários)
- **Playwright** (testes E2E)
