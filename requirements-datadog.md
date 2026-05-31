# Contexto

Aplicação Angular com observabilidade via Datadog. O `window.DD_LOGS` já está
inicializado e disponível globalmente (scripts do Datadog Logs e RUM já configurados).
O RUM tem sample de apenas 5% por custo, então vamos usar DD_LOGS (sample 100%)
para medir latência de tela, capturar erros de requisição e erros de JS.

O objetivo final é alimentar uma dashboard e um monitor de rollback automático
de canary, comparando a versão canary contra a stable.

# Tarefa

Implemente os itens abaixo. NÃO reinicialize o DD_LOGS — ele já existe no window.

## 1. ObservabilityService (injectable, providedIn: 'root')

Crie um serviço central que garante o schema dos logs. Schema fixo:

  event_type: 'latency' | 'request_error' | 'js_error' | 'render_complete'
  severity:   'info' | 'warning' | 'error'
  view_name?: string
  duration_ms?: number
  threshold_exceeded?: boolean
  http_status?: number
  endpoint?: string
  error_message?: string

Requisitos:
- No construtor, setar contexto global UMA vez (se window.DD_LOGS existir):
    window.DD_LOGS.setGlobalContextProperty('app_version', <APP_VERSION>)
    window.DD_LOGS.setGlobalContextProperty('deploy_type', <DEPLOY_TYPE>)
  app_version e deploy_type devem vir do environment / variável de build,
  NÃO hardcoded. Use placeholders __APP_VERSION__ / __DEPLOY_TYPE__ se não
  houver fonte ainda, mas deixe claro com um TODO de onde virão no CI.
- Método log(payload) que mapeia severity -> nível do DD
  (error->'error', warning->'warn', resto->'info') e chama
  window.DD_LOGS.logger.log(payload.event_type, {...payload}, level).
- Guard: se window.DD_LOGS não existir, não quebrar (early return).
- NÃO gerar session_id manualmente — o DD_LOGS já injeta.

## 2. Medição de latência de tela

- Marcar performance.now() no ngOnInit e medir no ngAfterViewInit.
- Logar SEMPRE o duration_ms (não só quando passar de 5s) para permitir
  cálculo de p95/p99. threshold = 5000ms apenas define event_type e severity:
    > 5000  -> event_type 'latency',          severity 'warning', threshold_exceeded true
    <= 5000 -> event_type 'render_complete',  severity 'info',    threshold_exceeded false
- ATENÇÃO: se a tela depende de dados assíncronos para estar "pronta",
  o log deve disparar no subscribe/tap da chamada que completa a tela,
  não no ngAfterViewInit (que só mede o esqueleto). Sinalize isso onde aplicável.
- Para evitar boilerplate, extraia um helper reutilizável (método utilitário
  ou diretiva/decorator) em vez de repetir em cada componente.

## 3. HttpInterceptor para erros de requisição

- Interceptor que captura falhas em catchError.
- Logar: event_type 'request_error', severity 'error',
  http_status (error.status ?? 0, onde 0 = erro de rede/CORS),
  endpoint (req.url), error_message (error.message).
- Re-propagar o erro com throwError(() => error).
- Registrar via HTTP_INTERCEPTORS (multi: true) no módulo,
  ou provideHttpClient(withInterceptorsFromDi()) se for standalone.

## 4. GlobalErrorHandler (ErrorHandler do Angular)

- Implementar ErrorHandler.handleError.
- Logar event_type 'js_error', severity 'error',
  error_message (error?.message ?? String(error)).
- Manter console.error(error) para não perder o comportamento padrão.
- Registrar como { provide: ErrorHandler, useClass: GlobalErrorHandler }.
- Adicionar também um listener window 'unhandledrejection' no bootstrap
  chamando obs.log com event_type 'js_error', para pegar promises fora do zone.

# Restrições

- TypeScript estरिct, sem any solto além do declare global do window.DD_LOGS.
- Não criar dependência circular entre ErrorHandler/Interceptor e o service
  (use injector/inject lazy se necessário, ErrorHandler é instanciado cedo).
- Não tocar na inicialização existente do DD_LOGS nem do RUM.
- Manter app_version e deploy_type como ÚNICA fonte da verdade no service
  (via global context), não repetir em cada chamada de log.

# Saída esperada

Liste os arquivos criados/alterados e mostre como registrar os providers.