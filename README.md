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

## Observabilidade — Datadog Logs

---

### Visão Geral

A aplicação instrumenta o **Datadog Browser Logs SDK** (`window.DD_LOGS`) para capturar quatro categorias de eventos em produção:

| Categoria | `event_type` | Origem |
|-----------|-------------|--------|
| Tela carregada dentro do SLA | `render_complete` | Componente — `logViewReady()` |
| Tela carregada acima do SLA | `latency` | Componente — `logViewReady()` |
| Falha em requisição HTTP | `request_error` | `DdLogsInterceptor` |
| Erro JavaScript não tratado | `js_error` | `GlobalErrorHandler` + listener `unhandledrejection` |

O objetivo é alimentar um **monitor de rollback automático de canary**: comparando `deploy_type: canary` contra `deploy_type: stable` em métricas de latência e taxa de erros.

> **Regra de ouro:** `window.DD_LOGS` é inicializado pela equipe de infraestrutura via script externo no `<head>`. A aplicação **nunca** chama `DD_LOGS.init()` — apenas usa `setGlobalContextProperty` e `logger.log`.

---

### Arquitetura da camada de observabilidade

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Window                           │
│                                                                 │
│   window.DD_LOGS  ◄──── único ponto de acesso                   │
│        ▲                                                        │
│        │  setGlobalContextProperty(app_version, deploy_type)    │
│        │  logger.log(event_type, payload, level)                │
│        │                                                        │
│   ┌────┴──────────────────────────────────────┐                 │
│   │         ObservabilityService              │                 │
│   │  - startTimer(viewName)                   │                 │
│   │  - logViewReady(viewName)                 │                 │
│   │  - log(payload: LogPayload)               │                 │
│   └────────┬──────────────┬───────────────────┘                 │
│            │              │                                     │
│   ┌────────▼──┐   ┌───────▼────────┐  ┌──────────────────────┐ │
│   │Components │   │DdLogsInterceptor│  │GlobalErrorHandler    │ │
│   │characters │   │(HTTP pipeline) │  │+ unhandledrejection  │ │
│   │films      │   │                │  │  (main.ts)           │ │
│   └───────────┘   └────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### Schema de eventos (`LogPayload`)

Todas as chamadas a `log()` respeitam o mesmo contrato definido em `src/app/core/types/dd-logs.types.ts`:

```typescript
interface LogPayload {
  event_type: 'render_complete' | 'latency' | 'request_error' | 'js_error'; // obrigatório
  severity:   'info' | 'warning' | 'error';                                  // obrigatório
  view_name?:          string;   // nome da tela, ex: 'characters', 'films'
  duration_ms?:        number;   // tempo de renderização em ms (inteiro)
  threshold_exceeded?: boolean;  // true quando duration_ms > 5000
  http_status?:        number;   // código HTTP, 0 = erro de rede/CORS
  endpoint?:           string;   // URL da requisição que falhou
  error_message?:      string;   // mensagem do erro
}
```

**Campos injetados automaticamente pelo SDK (não enviados pelo código):**

| Campo | Como chega | Exemplo |
|-------|-----------|---------|
| `app_version` | `setGlobalContextProperty` no constructor do `ObservabilityService` | `"abc1234"` |
| `deploy_type` | `setGlobalContextProperty` no constructor do `ObservabilityService` | `"canary"` |
| `session_id` | Injetado pelo próprio SDK Datadog | `"abc-123-..."` |

> `app_version` e `deploy_type` são definidos **uma única vez** por sessão e automaticamente anexados a **todos** os logs da sessão — incluindo os que o SDK Datadog gera internamente.

---

### `ObservabilityService`

**Arquivo:** `src/app/core/services/observability.service.ts`
**Escopo DI:** `providedIn: 'root'` — singleton, criado uma única vez por sessão.

É o **único arquivo** de toda a aplicação que referencia `window.DD_LOGS`. Qualquer nova funcionalidade de logging deve passar por este serviço.

#### Constructor

Executado uma vez, quando o Angular instancia o serviço (geralmente no primeiro componente que o injeta):

```typescript
constructor() {
  if (!window.DD_LOGS) return;  // guard: não quebra em ad blocker ou testes
  window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion);
  window.DD_LOGS.setGlobalContextProperty('deploy_type', environment.deployType);
}
```

Os valores de `appVersion` e `deployType` vêm de `environment.ts`, que é populado em build time pelo CI (ver seção [CI/CD](#variáveis-de-buildcicd)).

#### `startTimer(viewName: string)`

Marca o início da medição de uma tela. Armazena `performance.now()` em um `Map` interno indexado por `viewName`.

```typescript
obs.startTimer('characters');
// Console: [DD] ⏱ timer iniciado: characters
```

Chame no **constructor** do componente para capturar desde a instanciação pelo Angular. Para medir desde o clique de navegação, chame em um route guard antes da criação do componente.

#### `logViewReady(viewName: string)`

Encerra a medição, calcula a duração e envia o evento ao Datadog. Remove o timer do `Map` — uma segunda chamada sem um `startTimer` prévio emite `console.warn` e não envia nada.

```typescript
obs.logViewReady('characters');
// Se duration <= 5000ms:
//   Console: [DD] ✅ render OK: characters — 287 ms
//   Datadog: event_type=render_complete, severity=info, threshold_exceeded=false
//
// Se duration > 5000ms:
//   Console: [DD] ⚠️ render LENTO: characters — 6234 ms (> 5000 ms)
//   Datadog: event_type=latency, severity=warning, threshold_exceeded=true
```

**Por que usar `logViewReady` no observable e não em `ngAfterViewInit`?**

`ngAfterViewInit` dispara quando o DOM do componente é montado — mas os dados ainda não chegaram. Nesse ponto a tela mostra um spinner. A medição correta do tempo de renderização é o intervalo entre a criação do componente e o momento em que os dados ficam visíveis. Isso corresponde à **primeira emissão não-nula** do observable de dados.

Timers independentes por tela são suportados: chamar `startTimer('characters')` e `startTimer('films')` em paralelo funciona corretamente.

#### `log(payload: LogPayload)`

Envia um evento diretamente ao Datadog. Todos os outros métodos (`logViewReady`, `DdLogsInterceptor`, `GlobalErrorHandler`) usam este método internamente.

```typescript
obs.log({ event_type: 'js_error', severity: 'error', error_message: 'algo quebrou' });
// Console: console.error '[DD]' 'js_error' { ... }
// Datadog: logger.log('js_error', { ...payload }, 'error')
```

Mapeamento de `severity` → nível do DD:

| `severity` | Nível DD | Console |
|-----------|---------|---------|
| `'info'` | `'info'` | `console.log` |
| `'warning'` | `'warn'` | `console.warn` |
| `'error'` | `'error'` | `console.error` |

Se `window.DD_LOGS` estiver indefinido (ad blocker, testes sem mock), o método retorna silenciosamente após o `console.*` — sem lançar exceção.

---

### `DdLogsInterceptor`

**Arquivo:** `src/app/core/interceptors/dd-logs.interceptor.ts`
**Registro:** `app.config.ts` → `{ provide: HTTP_INTERCEPTORS, useClass: DdLogsInterceptor, multi: true }`

Intercepta **todas** as requisições HTTP da aplicação através da pipeline do `HttpClient`. Age como um side-effect: captura o erro, loga, e o re-lança — o fluxo normal da aplicação não é alterado.

#### Fluxo de uma requisição com erro

```
HttpClient.get('/api/people')
    ↓
DdLogsInterceptor.intercept()
    ↓ erro HTTP
    ├─► obs.log({ event_type: 'request_error', http_status: 500, endpoint: '/api/people', ... })
    │       └─► console.error '[DD]' 'request_error' { ... }
    │       └─► window.DD_LOGS.logger.log(...)
    └─► throwError(() => error)  ← erro segue para SwapiService.catchError → UI mostra mensagem em português
```

#### Campos enviados

| Campo | Origem | Observação |
|-------|--------|-----------|
| `http_status` | `error.status` | `0` para erros de rede ou CORS (sem resposta do servidor) |
| `endpoint` | `req.url` | URL completa da requisição |
| `error_message` | `error.message` | Mensagem do `HttpErrorResponse` |

#### Pré-requisito de registro em Angular standalone

Em aplicações Angular standalone, interceptors de classe são **ignorados silenciosamente** sem a flag `withInterceptorsFromDi()`:

```typescript
// app.config.ts — obrigatório para que o interceptor funcione
provideHttpClient(withFetch(), withInterceptorsFromDi())
```

---

### `GlobalErrorHandler`

**Arquivo:** `src/app/core/handlers/global-error.handler.ts`
**Registro:** `app.config.ts` → `{ provide: ErrorHandler, useClass: GlobalErrorHandler }`

Substitui o `ErrorHandler` padrão do Angular. Captura erros que escapam de qualquer `try/catch` ou `catchError` de observable dentro da **zone do Angular**.

#### O que captura

- Exceções lançadas em métodos de componentes, serviços ou diretivas sem tratamento local
- Erros de template Angular (ex: `undefined is not an object` em `{{ obj.prop }}`)
- Qualquer `throw` que suba até o topo da pilha de chamadas sem ser capturado

#### O que **não** captura (e como complementar)

Promises rejeitadas fora da zone do Angular não chegam ao `ErrorHandler`. Para esses casos, existe o listener `unhandledrejection` em `main.ts` (ver próxima seção).

#### Detalhe de injeção — por que usa `Injector` e não `ObservabilityService`

O Angular instancia o `ErrorHandler` muito cedo no bootstrap — antes de muitos outros serviços estarem prontos. Injetar `ObservabilityService` diretamente no constructor criaria uma dependência circular ou causaria erro de "provider not yet available".

Solução: injetar `Injector` no constructor (sempre disponível) e resolver `ObservabilityService` **dentro** de `handleError` (lazy injection):

```typescript
constructor(private injector: Injector) {}

handleError(error: unknown): void {
  console.error(error);  // sempre — preserva comportamento padrão
  try {
    const obs = this.injector.get(ObservabilityService);
    obs.log({ event_type: 'js_error', severity: 'error', error_message: ... });
  } catch {
    // injector ainda não pronto em erros muito precoces — console.error já foi chamado
  }
}
```

---

### Listener `unhandledrejection` — `src/main.ts`

Captura **promises rejeitadas fora da zone do Angular**: `fetch()` nativo, `setTimeout(() => Promise.reject(...))`, código de terceiros, etc.

Registrado **dentro do `.then()`** do `bootstrapApplication` para garantir que o DI container está completamente inicializado:

```typescript
bootstrapApplication(AppComponent, appConfig)
  .then((appRef) => {
    const obs = appRef.injector.get(ObservabilityService);
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      obs.log({
        event_type: 'js_error',
        severity: 'error',
        error_message: event.reason instanceof Error
          ? event.reason.message
          : String(event.reason ?? 'Unhandled rejection'),
      });
    });
  })
  .catch((err) => console.error(err));
```

---

### Como instrumentar uma nova tela

Erros HTTP e JS são capturados automaticamente. Só é necessário instrumentar a **latência de renderização**:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { filter, take, tap } from 'rxjs';
import { ObservabilityService } from '../core/services/observability.service';

@Component({ ... })
export class MinhaTelaComponent implements OnInit {
  private obs = inject(ObservabilityService);

  // Dados da tela — observable que emite null enquanto carrega
  dados$ = this.meuService.getDados().pipe(shareReplay(1));

  constructor() {
    // Inicia o timer quando o Angular cria o componente.
    // Para medir desde o clique de navegação, mova esta chamada
    // para um CanActivate guard desta rota.
    this.obs.startTimer('minha-tela');
  }

  ngOnInit(): void {
    // Encerra o timer quando os dados chegam e a tela está visível.
    this.dados$
      .pipe(
        filter((v) => v !== null),
        take(1),
        tap(() => this.obs.logViewReady('minha-tela'))
      )
      .subscribe();
  }
}
```

> O `view_name` deve ser o **path da rota** em lowercase (ex: `'characters'`, `'films'`, `'dashboard'`). Isso alinha com os facets do dashboard Datadog.

---

### Console output em desenvolvimento

Sem conta Datadog, todos os eventos aparecem no console do browser:

```
[DD] ⏱ timer iniciado: characters
[DD] ✅ render OK: characters — 287 ms
    → Datadog: event_type=render_complete, severity=info, duration_ms=287, threshold_exceeded=false

[DD] ⚠️ render LENTO: films — 6034 ms (> 5000 ms)
    → Datadog: event_type=latency, severity=warning, duration_ms=6034, threshold_exceeded=true

[DD] request_error { http_status: 0, endpoint: 'https://swapi.info/api/people', ... }
    → Datadog: event_type=request_error, severity=error

[DD] js_error { error_message: 'Cannot read properties of undefined' }
    → Datadog: event_type=js_error, severity=error
```

Para simular o SDK sem conta Datadog, cole no console antes de navegar:

```javascript
window.DD_LOGS = {
  setGlobalContextProperty: (k, v) => console.log('[DD] global:', k, '=', v),
  logger: { log: (msg, ctx, lvl) => console.log(`[DD][${lvl}]`, msg, ctx) }
};
```

---

### Variáveis de build (CI/CD)

O SDK identifica qual versão e slot do deploy enviou cada log via contexto global. Os valores são injetados em **build time** — não existem como variáveis de runtime.

| Variável CI | Substituição em `environment.ts` | Exemplo |
|-------------|----------------------------------|---------|
| `APP_VERSION` | `appVersion: '__APP_VERSION__'` → `appVersion: 'abc1234'` | SHA do commit |
| `DEPLOY_TYPE` | `deployType: '__DEPLOY_TYPE__'` → `deployType: 'canary'` | `'canary'` ou `'stable'` |

```bash
# Build de produção com injeção de versão:
ng build \
  --define "__APP_VERSION__=\"${APP_VERSION}\"" \
  --define "__DEPLOY_TYPE__=\"${DEPLOY_TYPE}\""

# Sem variáveis (desenvolvimento local):
ng build
# → appVersion='unknown', deployType='local'
# (defaults definidos em angular.json → projects.starwars-explorer.architect.build.options.define)
```

---

### Dashboard Datadog

**Arquivo:** `datadog/dashboards/canary-monitoring.json`

Importar via UI: Datadog → Dashboards → New Dashboard → **Import JSON**

Ou via API:

```bash
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "DD-API-KEY: <API_KEY>" \
  -H "DD-APPLICATION-KEY: <APP_KEY>" \
  -H "Content-Type: application/json" \
  -d @datadog/dashboards/canary-monitoring.json
```

**Widgets incluídos:**

| # | Widget | Tipo | Query |
|---|--------|------|-------|
| 1 | Taxa de Erros por Sessão | Timeseries | `(erros / total_eventos) × 100` agrupado por `@deploy_type` |
| 2 | Top Telas Mais Lentas | Toplist | p95 de `@duration_ms` agrupado por `@view_name` |
| 3 | Sessões por Versão | Toplist | `cardinality(@session_id)` agrupado por `@app_version` |
| 4 | Renders > 5s — Versão × Tela | Toplist | `count` de `@event_type:latency` agrupado por `@app_version` + `@view_name` |
| 5 | Evolução de Renders Lentos | Timeseries | `count` de `@event_type:latency` ao longo do tempo, por versão e tela |

**Template variables:** `$deploy_type` e `$app_version` permitem filtrar o dashboard por slot ou versão específica.

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
│   │   ├── swapi.service.ts          # Único ponto de acesso à SWAPI
│   │   └── observability.service.ts  # Facade DD_LOGS — startTimer, logViewReady, log
│   ├── interceptors/
│   │   └── dd-logs.interceptor.ts    # Captura erros HTTP (request_error)
│   ├── handlers/
│   │   └── global-error.handler.ts   # Captura erros JS / promises (js_error)
│   ├── types/
│   │   └── dd-logs.types.ts          # LogPayload, EventType, Severity, DdLogsInstance
│   └── testing/
│       └── dd-logs.mock.ts           # Mock de window.DD_LOGS para testes JEST
└── models/                   # Interfaces TypeScript (Character, Film, SwapiList)
```

## Tecnologias

- **Angular 17** (standalone, sem NgModule)
- **Angular Material 17** (Indigo/Pink)
- **RxJS 7** (observables, `switchMap`, `shareReplay`)
- **JEST** + `jest-preset-angular` (testes unitários)
- **Playwright** (testes E2E)
