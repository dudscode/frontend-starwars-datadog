# Datadog — Queries de Métricas e Alertas

Referência de queries para o Datadog Logs, configuração de monitors e alertas automáticos para a aplicação Star Wars Explorer.

Todos os logs usam `source:browser` e os atributos customizados com prefixo `@` definidos em `LogPayload`.

---

## 1. Queries de Exploração (Log Explorer)

Use estas queries na aba **Logs > Explorer** para investigar problemas manualmente.

### Todos os eventos da aplicação

```
source:browser @event_type:(render_complete OR latency OR request_error OR js_error)
```

### Apenas erros (HTTP + JS)

```
source:browser @event_type:(request_error OR js_error)
```

### Erros por slot de deploy

```
source:browser @event_type:(request_error OR js_error) @deploy_type:canary
source:browser @event_type:(request_error OR js_error) @deploy_type:stable
```

### Renders acima do SLA de 5 s

```
source:browser @event_type:latency @threshold_exceeded:true
```

### Renders lentos por tela específica

```
source:browser @event_type:latency @view_name:characters
source:browser @event_type:latency @view_name:films
```

### Renders lentos por versão e tela

```
source:browser @event_type:latency @app_version:abc1234 @view_name:characters
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

### Sessões com pelo menos um erro

```
source:browser @event_type:(request_error OR js_error) @session_id:*
```

---

## 2. Queries de Análise (Log Analytics)

Use estas queries na aba **Logs > Analytics** para visualizar métricas agregadas.

### Taxa de erro geral (% de eventos com erro)

**Numerador:**
```
source:browser @event_type:(request_error OR js_error)
  → aggregation: count
  → group by: @deploy_type
```

**Denominador:**
```
source:browser @event_type:(render_complete OR latency OR request_error OR js_error)
  → aggregation: count
  → group by: @deploy_type
```

**Fórmula:** `(errors / total) * 100`

---

### p95 de latência por tela e versão

```
source:browser @event_type:(render_complete OR latency)
  → aggregation: pc95(@duration_ms)
  → group by: @view_name, @app_version
```

---

### Contagem de renders lentos por versão e tela (janela de 1 h)

```
source:browser @event_type:latency @threshold_exceeded:true
  → aggregation: count
  → group by: @app_version, @view_name
  → rollup: 1h
```

---

### Número de sessões únicas por versão

```
source:browser
  → aggregation: cardinality(@session_id)
  → group by: @app_version
```

---

## 3. Monitors de Alerta

Configurações prontas para criar monitors em **Monitors > New Monitor > Logs**.

---

### Monitor 1 — Taxa de Erros Alta (qualquer slot)

**Quando alertar:** mais de 10 eventos de erro em 5 minutos em qualquer slot.

**Query:**
```
logs("source:browser @event_type:(request_error OR js_error)").rollup("count").last("5m") > 10
```

**Configuração sugerida:**

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Taxa de Erros Alta` |
| Tipo | Log Monitor |
| Janela de avaliação | 5 minutos |
| Threshold crítico (`ALERT`) | `> 10` eventos |
| Threshold de aviso (`WARN`) | `> 5` eventos |
| Mensagem | `Taxa de erros acima do limite. Deploy: {{@deploy_type.name}}. Versão: {{@app_version.name}}.` |
| Notify | `@pagerduty` ou `@slack-canal-alertas` |

---

### Monitor 2 — Renders Lentos Frequentes (acima de 5 s)

**Quando alertar:** mais de 5 renders lentos em 10 minutos na mesma tela.

**Query:**
```
logs("source:browser @event_type:latency @threshold_exceeded:true").rollup("count").last("10m") > 5
```

**Group by:** `@view_name` — alerta separado por tela.

**Configuração sugerida:**

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Renders Lentos Frequentes — {{@view_name.name}}` |
| Tipo | Log Monitor |
| Janela de avaliação | 10 minutos |
| Threshold crítico (`ALERT`) | `> 5` por tela |
| Threshold de aviso (`WARN`) | `> 2` por tela |
| Mensagem | `A tela {{@view_name.name}} teve {{value}} renders acima de 5s nos últimos 10 min. Versão: {{@app_version.name}}.` |

---

### Monitor 3 — Erros HTTP por Endpoint

**Quando alertar:** mais de 3 falhas no mesmo endpoint em 5 minutos.

**Query:**
```
logs("source:browser @event_type:request_error").rollup("count").last("5m") > 3
```

**Group by:** `@endpoint` — alerta separado por endpoint.

**Configuração sugerida:**

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars] Erros HTTP — {{@endpoint.name}}` |
| Tipo | Log Monitor |
| Janela de avaliação | 5 minutos |
| Threshold crítico | `> 3` por endpoint |
| Threshold de aviso | `> 1` por endpoint |
| Mensagem | `Endpoint {{@endpoint.name}} falhou {{value}} vezes (status: {{@http_status.name}}). Deploy: {{@deploy_type.name}}.` |

---

### Monitor 4 — Canary com Mais Erros que Stable (Rollback Signal)

**Quando alertar:** o canary tem proporcionalmente mais erros que o stable — sinal de regressão.

Este monitor usa dois queries separados e uma **fórmula comparativa**.

**Query A — erros no canary:**
```
logs("source:browser @event_type:(request_error OR js_error) @deploy_type:canary").rollup("count").last("15m")
```

**Query B — erros no stable:**
```
logs("source:browser @event_type:(request_error OR js_error) @deploy_type:stable").rollup("count").last("15m")
```

**Fórmula:** `a - b > 5`

Interpreta-se como: alertar quando o canary tiver mais de 5 erros a mais que o stable na mesma janela de 15 minutos.

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars][CANARY] Regressão de Erros vs Stable` |
| Tipo | Log Monitor (Composite) |
| Janela de avaliação | 15 minutos |
| Threshold crítico | `a - b > 5` |
| Threshold de aviso | `a - b > 2` |
| Mensagem | `O canary ({{a}} erros) está com mais erros que o stable ({{b}} erros) nos últimos 15 min. Considerar rollback. Versão canary: {{@app_version.name}}.` |

---

### Monitor 5 — Canary com Latência Pior que Stable (Rollback Signal)

**Quando alertar:** o p95 de renderização do canary é significativamente pior que o stable.

**Query A — renders lentos no canary:**
```
logs("source:browser @event_type:latency @threshold_exceeded:true @deploy_type:canary").rollup("count").last("15m")
```

**Query B — renders lentos no stable:**
```
logs("source:browser @event_type:latency @threshold_exceeded:true @deploy_type:stable").rollup("count").last("15m")
```

**Fórmula:** `a - b > 3`

| Campo | Valor |
|-------|-------|
| Nome | `[StarWars][CANARY] Degradação de Latência vs Stable` |
| Tipo | Log Monitor (Composite) |
| Janela de avaliação | 15 minutos |
| Threshold crítico | `a - b > 3` renders lentos a mais |
| Mensagem | `O canary tem {{a}} renders lentos contra {{b}} do stable nos últimos 15 min. Versão: {{@app_version.name}}. Tela mais afetada: {{@view_name.name}}.` |

---

## 4. JSON dos Monitors (Importar via API)

### Monitor 1 — Taxa de Erros Alta

```json
{
  "name": "[StarWars] Taxa de Erros Alta",
  "type": "log alert",
  "query": "logs(\"source:browser @event_type:(request_error OR js_error)\").rollup(\"count\").last(\"5m\") > 10",
  "message": "Taxa de erros acima do limite em {{log.attributes.deploy_type}}.\nVersão: {{log.attributes.app_version}}\n\n@pagerduty",
  "tags": ["team:frontend", "app:starwars-explorer"],
  "options": {
    "notify_audit": false,
    "locked": false,
    "thresholds": {
      "critical": 10,
      "warning": 5
    },
    "enable_logs_sample": true,
    "notify_no_data": false,
    "renotify_interval": 60
  }
}
```

### Monitor 2 — Renders Lentos

```json
{
  "name": "[StarWars] Renders Lentos Frequentes",
  "type": "log alert",
  "query": "logs(\"source:browser @event_type:latency @threshold_exceeded:true\").rollup(\"count\").last(\"10m\") > 5",
  "message": "A tela {{log.attributes.view_name}} teve {{value}} renders acima de 5s nos últimos 10 min.\nVersão: {{log.attributes.app_version}}\nDeploy: {{log.attributes.deploy_type}}\n\n@slack-alertas-frontend",
  "tags": ["team:frontend", "app:starwars-explorer"],
  "options": {
    "notify_audit": false,
    "locked": false,
    "thresholds": {
      "critical": 5,
      "warning": 2
    },
    "group_by": [
      { "facet": "@view_name", "sort": { "aggregation": "count", "order": "desc" }, "limit": 10 }
    ],
    "enable_logs_sample": true,
    "notify_no_data": false,
    "renotify_interval": 30
  }
}
```

### Monitor 3 — Erros HTTP por Endpoint

```json
{
  "name": "[StarWars] Erros HTTP por Endpoint",
  "type": "log alert",
  "query": "logs(\"source:browser @event_type:request_error\").rollup(\"count\").last(\"5m\") > 3",
  "message": "Endpoint {{log.attributes.endpoint}} falhou {{value}} vezes.\nStatus: {{log.attributes.http_status}}\nDeploy: {{log.attributes.deploy_type}}\n\n@slack-alertas-frontend",
  "tags": ["team:frontend", "app:starwars-explorer"],
  "options": {
    "notify_audit": false,
    "locked": false,
    "thresholds": {
      "critical": 3,
      "warning": 1
    },
    "group_by": [
      { "facet": "@endpoint", "sort": { "aggregation": "count", "order": "desc" }, "limit": 10 }
    ],
    "enable_logs_sample": true,
    "notify_no_data": false,
    "renotify_interval": 15
  }
}
```

---

## 5. Criar Monitors via API (script)

```bash
#!/bin/bash
# Cria todos os monitors de uma vez via API Datadog
# Uso: DD_API_KEY=<key> DD_APP_KEY=<key> bash create-monitors.sh

BASE_URL="https://api.datadoghq.com/api/v1/monitor"

for file in datadog/monitoring/monitors/*.json; do
  echo "Criando monitor: $file"
  curl -s -X POST "$BASE_URL" \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    -H "Content-Type: application/json" \
    -d @"$file" | python3 -m json.tool | grep '"id"\|"name"\|"status"'
  echo ""
done
```

---

## 6. Referência Rápida de Atributos

| Atributo | Tipo | Valores possíveis | Descrição |
|----------|------|------------------|-----------|
| `@event_type` | string | `render_complete`, `latency`, `request_error`, `js_error` | Categoria do evento |
| `@severity` | string | `info`, `warning`, `error` | Nível de severidade |
| `@deploy_type` | string | `canary`, `stable`, `local` | Slot de deploy |
| `@app_version` | string | SHA do commit, `unknown` | Versão do código |
| `@view_name` | string | `characters`, `films` | Nome da tela |
| `@duration_ms` | number | inteiro ≥ 0 | Tempo de renderização em ms |
| `@threshold_exceeded` | boolean | `true`, `false` | Se ultrapassou 5000 ms |
| `@http_status` | number | 0–599 | Código HTTP (0 = rede/CORS) |
| `@endpoint` | string | URL completa | Endpoint que falhou |
| `@error_message` | string | mensagem do erro | Descrição do erro |
| `@session_id` | string | UUID | Injetado automaticamente pelo SDK |
