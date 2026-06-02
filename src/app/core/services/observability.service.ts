import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LogPayload } from '../types/dd-logs.types';

const LATENCY_THRESHOLD_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  private timers = new Map<string, number>();
  private timeoutIds = new Map<string, ReturnType<typeof window.setTimeout>>();

  constructor() {
    if (!window.DD_LOGS) return;
    window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion);
    window.DD_LOGS.setGlobalContextProperty('deploy_type', environment.deployType);
  }

  /**
   * Marca o início da medição de uma tela e arma um timeout automático.
   *
   * Se logViewReady() não for chamado em LATENCY_THRESHOLD_MS (5 s), o timer
   * dispara sozinho e envia um evento latency ao Datadog — garante que nenhuma
   * medição fique em aberto independente do que aconteça com o componente.
   *
   * Se startTimer() for chamado novamente para a mesma tela (re-navegação),
   * o timeout anterior é cancelado e um novo é criado.
   */
  startTimer(viewName: string): void {
    // Cancela timeout anterior desta tela (re-navegação antes de expirar)
    const existingTimeout = this.timeoutIds.get(viewName);
    if (existingTimeout !== undefined) {
      clearTimeout(existingTimeout);
    }

    const start = performance.now();
    this.timers.set(viewName, start);

    const id = window.setTimeout(() => {
      this.timeoutIds.delete(viewName);
      console.warn(
        `[DD] ⏰ timeout automático: ${viewName} — não finalizou em ${LATENCY_THRESHOLD_MS} ms`
      );
      this.logViewReady(viewName);
    }, LATENCY_THRESHOLD_MS);

    this.timeoutIds.set(viewName, id);
    console.log(`[DD] ⏱ timer iniciado: ${viewName}`);
  }

  /**
   * Encerra a medição e envia o evento de latência.
   *
   * Chamado em dois cenários:
   *  1. Dados chegaram (caminho normal) → chamado pelo tap() do observable.
   *  2. Componente destruído antes dos dados → chamado pelo ngOnDestroy().
   *
   * O timeout automático de startTimer() é cancelado aqui quando o encerramento
   * ocorre antes dos 5 s — impede double-log.
   *
   * Retorno silencioso se o timer não existir (já expirou automaticamente
   * ou ngOnDestroy chamou depois do tap()).
   */
  logViewReady(viewName: string): void {
    // Cancela o timeout automático se ainda não disparou
    const timeoutId = this.timeoutIds.get(viewName);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(viewName);
    }

    const start = this.timers.get(viewName);
    if (start === undefined) {
      // Timer já foi encerrado (timeout automático, tap() ou ngOnDestroy anterior)
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
}
