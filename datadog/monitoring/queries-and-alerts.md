# Datadog — Queries de Métricas e Alertas

Referência de queries para o Datadog Logs, configuração de monitors e alertas automáticos para a aplicação Star Wars Explorer.

Todos os logs usam `source:browser` e os atributos customizados com prefixo `@` definidos em `LogPayload`.

---

## Referência de event_type

| `event_type` | `severity` | Quando ocorre | Como é gerado |
|---|---|---|---|
| `render_complete` | `info` | Tela carregou em ≤ 5 s | `logViewReady()` com duração ≤ 5 000 ms |
| `latency` | `warning` | Tela carregou em > 5 s | `logViewReady()` com duração > 5 000 ms |
| `timer_lost` | `error` | `logViewReady()` nunca foi chamado em 1 min | `setTimeout` interno de 60 000 ms |
| `request_error` | `error` | Falha HTTP | `DdLogsInterceptor` |
| `js_error` | `error` | Erro JS não tratado | `GlobalErrorHandler` + `unhandledrejection` |

> **`latency` ≠ `timer_lost`**: `latency` significa que os dados chegaram devagar (> 5 s mas < 1 min).
> `timer_lost` significa que os dados **nunca chegaram** — timeout de 1 min disparou automaticamente.

---

## 1. Queries de Exploração (Log Explorer)

Use estas queries na aba **Logs > Explorer** para investigar problemas manualmente.

### Todos os eventos da aplicação

```
source:browser @event_type:(render_complete OR latency OR timer_lost OR request_error OR js_error)
```

### Apenas erros (HTTP + JS + timer perdido)

```
source:browser @event_type:(request_error OR js_error OR timer_lost)
```

### Timers perdidos — telas que nunca finalizaram em 1 min

```
source:browser @event_type:timer_lost
```

### Renders lentos (dados chegaram mas demoraram > 5 s)

```
source:browser @event_type:latency @threshold_exceeded:true
```

### Erros por slot de deploy

```
source:browser @event_type:(request_error OR js_error OR timer_lost) @deploy_type:canary
source:browser @event_type:(request_error OR js_error OR timer_lost) @deploy_type:stable
```

### Timers perdidos por tela e versão

```
source:browser @event_type:timer_lost @view_name:characters @deploy_type:canary
source:browser @event_type:timer_lost @app_version:abc1234
```

### Renders lentos por tela específica

```
source:browser @event_type:latency @view_name:characters
source:browser @event_type:latency @view_name:films
```

### Erros HTTP por endpoint e status

```
source:browser @event_type:request_error @http_status:500
source:browser @event_type:request_error @http_status:0
```

### Comparar latência canary vs stable na mesma tela

```
source:browser @event_type:(render_complete OR latency) @view_name:characters @deploy_type:canary
source:browser @event_type:(render_complete OR latency) @view_name:characters @deploy_type:stable
```

---

## 2. Queries de Análise (Log Analytics)

Use estas queries na aba **Logs > Analytics** para visualizar métricas agregadas.

### Taxa de erros geral — inclui timer_lost

```
Numerador:
  source:browser @event_type:(request_error OR js_error OR timer_lost)
  → aggregation: count
  → group by: @deploy_type

Denominador:
  source:browser @event_type:(render_complete OR latency OR timer_lost OR request_error OR js_error)
  → aggregation: count
  → group by: @deploy_type

Fórmula: (errors / total) * 100
```

### p95 de latência por tela e versão (apenas renders que finalizaram)

```
source:browser @event_type:(render_complete OR latency)
  → aggregation: pc95(@duration_ms)
  → group by: @view_name, @app_version
```

### Contagem de renders lentos por versão e tela

```
source:browser @event_type:latency @threshold_exceeded:true
  → aggregation: count
  → group by: @app_version, @view_name
  → rollup: 1h
```

### Contagem de timers perdidos por versão e tela

```
source:browser @event_type:timer_lost
  → aggregation: count
  → group by: @app_version, @view_name
  → rollup: 1h
```

### Número de sessões únicas por versão

```
source:browser
  → aggregation: cardinality(@session_id)
  → group by: @app_version
```

---

## 3. Monitors de Alerta

### Monitor 1 — Taxa de Erros Alta (erros + timers perdidos)

**Quando alertar:** mais de 10 eventos críticos em 5 minutos.

```
logs("source:browser @event_type:(request_error OR js_error OR timer_lost)").rollup("count").last("5m") > 10
```

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Taxa de Erros Alta` |
| Janela | 5 minutos |
| ALERT | `> 10` eventos |
| WARN | `> 5` eventos |

---

### Monitor 2 — Renders Lentos Frequentes (> 5 s, dados chegaram)

**Quando alertar:** mais de 5 renders lentos em 10 minutos na mesma tela.

```
logs("source:browser @event_type:latency @threshold_exceeded:true").rollup("count").last("10m") > 5
```

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Renders Lentos — {{@view_name.name}}` |
| Group by | `@view_name` |
| Janela | 10 minutos |
| ALERT | `> 5` por tela |
| WARN | `> 2` por tela |
| Mensagem | `A tela {{@view_name.name}} teve {{value}} renders > 5s em 10 min. Dados chegaram devagar. Versão: {{@app_version.name}}.` |

---

### Monitor 3 — Timers Perdidos (dados nunca chegaram em 1 min)

**Quando alertar:** qualquer ocorrência de `timer_lost` — indica tela travada ou dados nunca recebidos.

```
logs("source:browser @event_type:timer_lost").rollup("count").last("10m") > 0
```

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Timer Perdido — {{@view_name.name}}` |
| Group by | `@view_name`, `@deploy_type` |
| Janela | 10 minutos |
| ALERT | `> 0` (qualquer ocorrência é crítica) |
| Mensagem | `Timer perdido na tela {{@view_name.name}}. Os dados nunca chegaram em 1 min. Deploy: {{@deploy_type.name}}. Versão: {{@app_version.name}}. Investigar: rede, timeout de API, componente travado.` |

---

### Monitor 4 — Erros HTTP por Endpoint

```
logs("source:browser @event_type:request_error").rollup("count").last("5m") > 3
```

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Erros HTTP — {{@endpoint.name}}` |
| Group by | `@endpoint` |
| ALERT | `> 3` por endpoint |
| WARN | `> 1` por endpoint |

---

### Monitor 5 — Canary com Mais Erros que Stable (Rollback Signal)

Inclui `timer_lost` na contagem de erros para capturar regressões de carregamento.

```
Query A: logs("source:browser @event_type:(request_error OR js_error OR timer_lost) @deploy_type:canary").rollup("count").last("15m")
Query B: logs("source:browser @event_type:(request_error OR js_error OR timer_lost) @deploy_type:stable").rollup("count").last("15m")
Fórmula: a - b > 5
```

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars][CANARY] Regressão de Erros vs Stable` |
| ALERT | `a - b > 5` |
| WARN | `a - b > 2` |

---

### Monitor 6 — Canary com Mais Timers Perdidos que Stable (Rollback Signal)

Específico para `timer_lost` — canary travando telas que o stable não trava.

```
Query A: logs("source:browser @event_type:timer_lost @deploy_type:canary").rollup("count").last("15m")
Query B: logs("source:browser @event_type:timer_lost @deploy_type:stable").rollup("count").last("15m")
Fórmula: a - b > 1
```

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars][CANARY] Timers Perdidos vs Stable` |
| ALERT | `a - b > 1` (qualquer aumento é suspeito) |
| Mensagem | `O canary tem {{a}} timers perdidos contra {{b}} do stable. Tela: {{@view_name.name}}. Provável regressão de carregamento. Versão: {{@app_version.name}}.` |

---

### Monitor 7 — Canary com Latência Pior que Stable

```
Query A: logs("source:browser @event_type:latency @threshold_exceeded:true @deploy_type:canary").rollup("count").last("15m")
Query B: logs("source:browser @event_type:latency @threshold_exceeded:true @deploy_type:stable").rollup("count").last("15m")
Fórmula: a - b > 3
```

---

## 4. JSON dos Monitors (importar via API)

### Monitor 1 — Taxa de Erros + Timer Perdido

```json
{
  "name": "[StarWars] Taxa de Erros Alta",
  "type": "log alert",
  "query": "logs(\"source:browser @event_type:(request_error OR js_error OR timer_lost)\").rollup(\"count\").last(\"5m\") > 10",
  "message": "Taxa de erros acima do limite em {{log.attributes.deploy_type}}.\nVersão: {{log.attributes.app_version}}\n\n@pagerduty",
  "tags": ["team:frontend"],
  "options": {
    "thresholds": { "critical": 10, "warning": 5 },
    "enable_logs_sample": true,
    "notify_no_data": false,
    "renotify_interval": 60
  }
}
```

### Monitor 3 — Timer Perdido (severidade máxima, qualquer ocorrência)

```json
{
  "name": "[StarWars] Timer Perdido",
  "type": "log alert",
  "query": "logs(\"source:browser @event_type:timer_lost\").rollup(\"count\").last(\"10m\") > 0",
  "message": "Timer perdido na tela {{log.attributes.view_name}}.\nOs dados não chegaram em 1 minuto.\nDeploy: {{log.attributes.deploy_type}}\nVersão: {{log.attributes.app_version}}\nInvestigar: timeout de API, rede, componente travado.\n\n@pagerduty",
  "tags": ["team:frontend"],
  "options": {
    "thresholds": { "critical": 0 },
    "group_by": [
      { "facet": "@view_name", "limit": 10, "sort": { "aggregation": "count", "order": "desc" } },
      { "facet": "@deploy_type", "limit": 5, "sort": { "aggregation": "count", "order": "desc" } }
    ],
    "enable_logs_sample": true,
    "notify_no_data": false,
    "renotify_interval": 15
  }
}
```

---

## 5. Referência Rápida de Atributos

| Atributo | Tipo | Valores | Descrição |
|----------|------|---------|-----------|
| `@event_type` | string | `render_complete`, `latency`, `timer_lost`, `request_error`, `js_error` | Categoria do evento |
| `@severity` | string | `info`, `warning`, `error` | Nível de severidade |
| `@deploy_type` | string | `canary`, `stable`, `local` | Slot de deploy |
| `@app_version` | string | SHA do commit, `unknown` | Versão do código |
| `@view_name` | string | `characters`, `films` | Nome da tela |
| `@duration_ms` | number | inteiro ≥ 0 | Tempo desde startTimer até logViewReady (ou timeout) |
| `@threshold_exceeded` | boolean | `true`, `false` | `duration_ms > 5 000` para latency; sempre `true` para timer_lost |
| `@http_status` | number | 0–599 | Código HTTP (0 = rede/CORS) |
| `@endpoint` | string | URL completa | Endpoint que falhou |
| `@error_message` | string | mensagem | Descrição do erro |
| `@session_id` | string | UUID | Injetado automaticamente pelo SDK |

---

## 6. Limites de tempo configurados

| Constante | Valor | Propósito |
|-----------|-------|-----------|
| `LATENCY_THRESHOLD_MS` | 5 000 ms (5 s) | Separa `render_complete` de `latency` — SLA de carregamento |
| `TIMER_LOST_TIMEOUT_MS` | 60 000 ms (1 min) | Prazo máximo antes de considerar o timer perdido e disparar `timer_lost` |
