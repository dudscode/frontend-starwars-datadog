import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LogPayload } from '../types/dd-logs.types';

/** Threshold para distinguir render lento (latency) de render normal (render_complete). */
const LATENCY_THRESHOLD_MS = 5_000; // 5 s

/**
 * Se logViewReady() não for chamado neste prazo, o timer é considerado perdido
 * e um evento `timer_lost` é enviado automaticamente ao Datadog.
 */
const TIMER_LOST_TIMEOUT_MS = 60_000; // 1 min

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  /**
   * Timestamp de início de cada timer ativo, indexado por viewName.
   * Múltiplos timers podem existir em simultâneo — cada tela tem sua própria entrada.
   */
  private timers = new Map<string, number>();

  /**
   * ID do setTimeout de cada timer ativo, indexado por viewName.
   * Usado para cancelar o auto-timeout quando logViewReady() encerrar
   * o timer normalmente antes do prazo de 1 min.
   *
   * Tipado como ReturnType<typeof setTimeout> para compatibilidade com @types/node
   * (que sobrescreve setTimeout para retornar NodeJS.Timeout em vez de number).
   */
  private timeoutIds = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    if (!window.DD_LOGS) return;
    window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion);
    window.DD_LOGS.setGlobalContextProperty('deploy_type', environment.deployType);
  }

  /**
   * Inicia um timer de renderização para a tela indicada.
   *
   * Após TIMER_LOST_TIMEOUT_MS (1 min), se logViewReady() não for chamado,
   * o serviço envia automaticamente um evento `timer_lost` ao Datadog.
   *
   * Escala: múltiplas telas podem ter timers ativos ao mesmo tempo; cada uma
   * tem sua própria entrada nos Maps `timers` e `timeoutIds`.
   * Re-navegação para a mesma tela (startTimer chamado 2x) cancela o timeout
   * anterior e inicia um novo ciclo.
   */
  startTimer(viewName: string): void {
    const existing = this.timeoutIds.get(viewName);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.timeoutIds.delete(viewName);
    }

    const start = performance.now();
    this.timers.set(viewName, start);

    const id = setTimeout(() => {
      this.timeoutIds.delete(viewName);
      this._fireTimerLost(viewName);
    }, TIMER_LOST_TIMEOUT_MS);

    this.timeoutIds.set(viewName, id);
    console.log(`[DD] ⏱ timer iniciado: ${viewName}`);
  }

  /**
   * Encerra o timer e envia o evento de latência.
   *
   * Chamado em dois cenários:
   *  1. Dados chegaram (caminho normal) → tap() no observable.
   *  2. Componente destruído antes dos dados → ngOnDestroy().
   *
   * Envia:
   *  - render_complete (info)    se duration_ms ≤ LATENCY_THRESHOLD_MS (5 s)
   *  - latency         (warning) se duration_ms >  LATENCY_THRESHOLD_MS (5 s)
   *
   * Para o caso em que os dados nunca chegam em 1 min, o auto-timeout
   * de startTimer() envia `timer_lost` (event distinto de `latency`).
   *
   * Retorno silencioso se o timer já foi encerrado.
   */
  logViewReady(viewName: string): void {
    const timeoutId = this.timeoutIds.get(viewName);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(viewName);
    }

    const start = this.timers.get(viewName);
    if (start === undefined) return;

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
   * Disparado pelo setTimeout de startTimer() após TIMER_LOST_TIMEOUT_MS (1 min).
   * Envia `timer_lost` — distinto de `latency` porque os dados nunca chegaram,
   * independentemente da duração.
   */
  private _fireTimerLost(viewName: string): void {
    const start = this.timers.get(viewName);
    if (start === undefined) return;

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
