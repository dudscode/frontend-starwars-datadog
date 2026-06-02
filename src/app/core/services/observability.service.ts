import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LogPayload } from '../types/dd-logs.types';

const LATENCY_THRESHOLD_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  /**
   * Armazena o timestamp de início de cada timer ativo, indexado por viewName.
   * Múltiplos timers podem existir em simultâneo (ex: navegação rápida entre telas).
   */
  private timers = new Map<string, number>();

  /**
   * Armazena o ID do setTimeout de cada timer ativo, indexado por viewName.
   * Necessário para cancelar o timeout quando logViewReady() for chamado antes
   * dos 5 s — evita que o auto-fire dispare depois que o timer já foi encerrado.
   */
  private timeoutIds = new Map<string, ReturnType<typeof window.setTimeout>>();

  constructor() {
    if (!window.DD_LOGS) return;
    window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion);
    window.DD_LOGS.setGlobalContextProperty('deploy_type', environment.deployType);
  }

  /**
   * Inicia um timer de renderização para a tela indicada.
   *
   * Após LATENCY_THRESHOLD_MS (5 s), se logViewReady() não for chamado,
   * o serviço envia automaticamente um evento `timer_lost` ao Datadog —
   * indicando que os dados nunca chegaram dentro do período esperado.
   *
   * Escala: múltiplas telas podem ter timers ativos ao mesmo tempo; cada uma
   * tem sua própria entrada nos Maps `timers` e `timeoutIds`.
   * Se startTimer() for chamado novamente para a mesma tela (re-navegação),
   * o timeout anterior é cancelado e um novo ciclo começa.
   */
  startTimer(viewName: string): void {
    // Re-navegação: cancela o timeout anterior desta tela antes de iniciar um novo
    const existing = this.timeoutIds.get(viewName);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.timeoutIds.delete(viewName);
    }

    const start = performance.now();
    this.timers.set(viewName, start);

    const id = window.setTimeout(() => {
      this.timeoutIds.delete(viewName);
      this._fireTimerLost(viewName);
    }, LATENCY_THRESHOLD_MS);

    this.timeoutIds.set(viewName, id);
    console.log(`[DD] ⏱ timer iniciado: ${viewName}`);
  }

  /**
   * Encerra o timer e envia o evento de latência.
   *
   * Deve ser chamado quando os dados chegaram e a tela está visível:
   *  - Caminho normal: tap() no primeiro valor não-nulo do observable.
   *  - Fallback de segurança: ngOnDestroy(), caso os dados cheguem após a
   *    destruição do componente ou nunca cheguem.
   *
   * Se o timer já foi encerrado (pelo auto-timeout ou por uma chamada anterior),
   * retorna silenciosamente — sem double-log.
   *
   * Envia:
   *  - `render_complete` (info)  se duration_ms ≤ 5 000 ms — tela dentro do SLA
   *  - `latency`         (warning) se duration_ms > 5 000 ms — tela lenta mas finalizou
   *
   * Para o caso em que os dados nunca chegam, use o auto-timeout de startTimer()
   * que envia `timer_lost`.
   */
  logViewReady(viewName: string): void {
    // Cancela o auto-timeout: o encerramento aconteceu antes dos 5 s (ou no destroy)
    const timeoutId = this.timeoutIds.get(viewName);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(viewName);
    }

    const start = this.timers.get(viewName);
    if (start === undefined) {
      // Timer já foi encerrado pelo auto-timeout ou por chamada anterior — sem ação
      return;
    }

    this.timers.delete(viewName);
    const duration_ms = Math.round(performance.now() - start);
    const exceeded = duration_ms > LATENCY_THRESHOLD_MS;

    if (exceeded) {
      console.warn(
        `[DD] ⚠️ render LENTO: ${viewName} — ${duration_ms} ms (> ${LATENCY_THRESHOLD_MS} ms)`
      );
    } else {
      console.log(`[DD] ✅ render OK: ${viewName} — ${duration_ms} ms`);
    }

    this.log({
      event_type: exceeded ? 'latency' : 'render_complete',
      severity: exceeded ? 'warning' : 'info',
      view_name: viewName,
      duration_ms,
      threshold_exceeded: exceeded,
    });
  }

  log(payload: LogPayload): void {
    const consoleFn =
      payload.severity === 'error'
        ? console.error
        : payload.severity === 'warning'
        ? console.warn
        : console.log;

    consoleFn('[DD]', payload.event_type, payload);

    if (!window.DD_LOGS) return;
    const level =
      payload.severity === 'error'
        ? 'error'
        : payload.severity === 'warning'
        ? 'warn'
        : 'info';
    window.DD_LOGS.logger.log(payload.event_type, { ...payload }, level);
  }

  /**
   * Disparado pelo setTimeout de startTimer() quando os dados não chegaram
   * em LATENCY_THRESHOLD_MS. Envia `timer_lost` — distinto de `latency`
   * (render lento que finalizou) porque neste caso os dados nunca chegaram.
   */
  private _fireTimerLost(viewName: string): void {
    const start = this.timers.get(viewName);
    if (start === undefined) return; // logViewReady() foi chamado no mesmo tick

    this.timers.delete(viewName);
    const duration_ms = Math.round(performance.now() - start);

    console.error(
      `[DD] ❌ timer perdido: ${viewName} — dados não chegaram em ${duration_ms} ms`
    );

    this.log({
      event_type: 'timer_lost',
      severity: 'error',
      view_name: viewName,
      duration_ms,
      threshold_exceeded: true,
    });
  }
}
