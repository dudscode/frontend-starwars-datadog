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

A camada de observabilidade captura eventos estruturados via `window.DD_LOGS` (Datadog Browser Logs SDK). O SDK é **inicializado pela equipe de infraestrutura** via script externo — a aplicação apenas envia logs, nunca reinicializa o SDK.

### O que cada peça faz

#### `ObservabilityService` — `src/app/core/services/observability.service.ts`

Ponto central de todos os logs. É o **único arquivo** que acessa `window.DD_LOGS` diretamente.

**No constructor (executado uma única vez na vida da aplicação):**
- Define `app_version` e `deploy_type` como contexto global do DD_LOGS via `setGlobalContextProperty`.
- Isso faz com que **todos** os logs enviados pela sessão — inclusive os do próprio SDK Datadog — carreguem esses dois campos automaticamente, sem precisar repeti-los em cada evento.

**Método `log(payload)`:**
- Recebe um objeto `LogPayload` com o schema fixo (`event_type`, `severity`, campos opcionais).
- Converte `severity` para o nível do DD (`'warning'` → `'warn'`, o resto direto).
- Chama `window.DD_LOGS.logger.log(event_type, {...payload}, level)`.
- Se `window.DD_LOGS` não existir (ad blocker, ambiente de teste sem mock), retorna silenciosamente sem erro.

**Método `watchView(viewName, ready$)`:**
- Recebe o nome da tela e o observable que emite quando os dados chegam (ex: `pageView$`).
- Registra `performance.now()` no momento em que é chamado (início da medição).
- Escuta a **primeira emissão não-nula** do observable (o momento em que o conteúdo fica visível para o usuário).
- Calcula a duração em ms, verifica se ultrapassou o threshold de **5000 ms** e envia:
  - `render_complete` + `severity: info` se ≤ 5 s
  - `latency` + `severity: warning` se > 5 s
- A subscription se auto-cancela após a primeira emissão (`take(1)`) — sem memory leak.
- Por que o observable e não `ngAfterViewInit`? Porque ambas as telas mostram um spinner enquanto os dados carregam. `ngAfterViewInit` mede apenas o tempo até o spinner aparecer, não até os dados ficarem visíveis.

---

#### `DdLogsInterceptor` — `src/app/core/interceptors/dd-logs.interceptor.ts`

Intercepta **todas** as chamadas HTTP da aplicação. Fica na pipeline do `HttpClient`.

**O que faz em caso de erro:**
1. Extrai `error.status` (código HTTP), `req.url` (endpoint) e `error.message`.
2. Chama `ObservabilityService.log` com `event_type: 'request_error'`.
3. **Re-lança o erro** com `throwError(() => error)` — o comportamento existente (mensagem de erro em português, estado de retry) continua funcionando normalmente.

**Como é registrado:** em `app.config.ts` como `HTTP_INTERCEPTORS` provider com `multi: true`, junto com `withInterceptorsFromDi()` no `provideHttpClient`. Sem esses dois, interceptors de classe são ignorados silenciosamente em Angular standalone.

---

#### `GlobalErrorHandler` — `src/app/core/handlers/global-error.handler.ts`

Substitui o `ErrorHandler` padrão do Angular para capturar erros que escapam de qualquer `try/catch` ou `catchError` de observable.

**O que captura:**
- Erros síncronos lançados dentro da zone do Angular (ex: `throw new Error(...)` em um método de componente).
- Erros de template (referência a propriedade undefined em `{{ x.y }}`).

**O que NÃO captura sozinho:**
- Promises rejeitadas fora da zone do Angular (ex: `fetch(...).then(...).catch(...)` iniciado fora de um método Angular). Para isso existe o listener de `unhandledrejection` em `main.ts`.

**Detalhe de implementação importante:** o `ErrorHandler` é instanciado pelo Angular **antes** de muitos outros serviços. Por isso, ele injeta `Injector` no constructor (e não `ObservabilityService` diretamente), e só resolve o serviço dentro do `handleError`. Isso evita dependência circular no bootstrap.

**Comportamento:**
1. Chama `console.error(error)` **sempre** — preserva o comportamento padrão do browser.
2. Tenta obter `ObservabilityService` via `injector.get(...)` e envia `event_type: 'js_error'`.
3. Se o injector ainda não estiver pronto (erros muito precoces), o `try/catch` absorve silenciosamente — `console.error` já foi chamado.

---

#### Listener `unhandledrejection` — `src/main.ts`

Captura promises rejeitadas **fora da zone do Angular**, que o `GlobalErrorHandler` não consegue pegar.

**Quando dispara:**
- `Promise.reject(...)` sem `.catch()` em qualquer parte do código
- `async function` que lança sem `try/catch`
- Requests `fetch()` nativos que falham sem tratamento

**Como funciona:** registrado dentro do `.then()` do `bootstrapApplication(...)`, garantindo que o DI container já está pronto quando o listener é instalado. Usa `appRef.injector.get(ObservabilityService)` para obter o serviço.

---

### Schema de eventos

Todos os eventos seguem o mesmo schema (`LogPayload`):

| Campo | Tipo | Obrigatório | Usado em |
|-------|------|-------------|----------|
| `event_type` | `'render_complete' \| 'latency' \| 'request_error' \| 'js_error'` | ✅ | todos |
| `severity` | `'info' \| 'warning' \| 'error'` | ✅ | todos |
| `view_name` | `string` | — | `render_complete`, `latency` |
| `duration_ms` | `number` | — | `render_complete`, `latency` |
| `threshold_exceeded` | `boolean` | — | `render_complete`, `latency` |
| `http_status` | `number` | — | `request_error` |
| `endpoint` | `string` | — | `request_error` |
| `error_message` | `string` | — | `request_error`, `js_error` |

Campos injetados automaticamente pelo DD_LOGS (não aparecem no código):

| Campo | Origem |
|-------|--------|
| `app_version` | Contexto global — setado pelo `ObservabilityService` constructor via CI |
| `deploy_type` | Contexto global — `'canary'` ou `'stable'` via CI |
| `session_id` | Injetado pelo próprio SDK Datadog |

---

### Como aplicar em uma nova tela

Se você adicionar uma terceira tela, basta:

```typescript
// 1. Injetar o serviço
private obs = inject(ObservabilityService);
private readonly viewStart = performance.now();

// 2. Implementar ngOnInit
ngOnInit(): void {
  // Passar o observable que emite quando os dados ficam prontos
  // (o primeiro valor não-nulo)
  this.obs.watchView('nome-da-tela', this.meuDado$);
}
```

Erros HTTP e JS já são capturados automaticamente pelo interceptor e pelo error handler — nenhuma ação extra necessária.

---

### Testar localmente (sem conta Datadog)

Cole no console do browser **antes** de navegar:

```javascript
window.DD_LOGS = {
  setGlobalContextProperty: (k, v) => console.log('[DD] global:', k, v),
  logger: { log: (msg, ctx, lvl) => console.log(`[DD][${lvl}] ${msg}`, ctx) }
};
```

Exemplo do que você verá ao abrir `/characters`:

```
[DD] global: app_version __APP_VERSION__
[DD] global: deploy_type __DEPLOY_TYPE__
[DD][info] render_complete { event_type: 'render_complete', severity: 'info', view_name: 'characters', duration_ms: 312, threshold_exceeded: false }
```

Para simular erro de rede: DevTools → Network → Offline → recarregue a página.

---

### Variáveis de build (CI/CD)

| Variável de ambiente | Valor no build | Resultado em `environment.ts` |
|----------------------|---------------|-------------------------------|
| `APP_VERSION` | SHA do commit (ex: `abc1234`) | `appVersion: 'abc1234'` |
| `DEPLOY_TYPE` | `canary` ou `stable` | `deployType: 'canary'` |

```bash
# Comando de build no CI:
ng build \
  --define "__APP_VERSION__=\"${APP_VERSION}\"" \
  --define "__DEPLOY_TYPE__=\"${DEPLOY_TYPE}\""
```

Se as variáveis não forem passadas, os valores padrão são `'unknown'` e `'local'` (definidos em `angular.json` → `define`).

---

### Dashboard Datadog

O arquivo `datadog/dashboards/canary-monitoring.json` contém um dashboard pronto com 4 widgets:

| Widget | O que mostra |
|--------|-------------|
| **Taxa de Erros por Sessão** | `(erros / total_eventos) × 100` agrupado por `deploy_type` |
| **Top Telas Mais Lentas** | p95 de `duration_ms` por `view_name` |
| **Sessões por Versão** | `cardinality(session_id)` por `app_version` |
| **Renders > 5s por Versão** | Contagem de `event_type:latency` por `app_version` |

**Para importar:**

```bash
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "DD-API-KEY: <API_KEY>" \
  -H "DD-APPLICATION-KEY: <APP_KEY>" \
  -H "Content-Type: application/json" \
  -d @datadog/dashboards/canary-monitoring.json
```

Ou via UI: Datadog → Dashboards → New Dashboard → **Import JSON**.

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
