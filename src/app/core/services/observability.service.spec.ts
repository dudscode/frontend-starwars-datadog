import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ObservabilityService } from './observability.service';
import { setupDdLogsMock } from '../testing/dd-logs.mock';
import { environment } from '../../../environments/environment';

describe('ObservabilityService', () => {
  setupDdLogsMock();

  let service: ObservabilityService;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.configureTestingModule({});
    service = TestBed.inject(ObservabilityService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── constructor ──────────────────────────────────────────────────────────

  describe('constructor — global context setup', () => {
    it('should set app_version and deploy_type when DD_LOGS exists', () => {
      expect(window.DD_LOGS!.setGlobalContextProperty).toHaveBeenCalledWith(
        'app_version', environment.appVersion
      );
      expect(window.DD_LOGS!.setGlobalContextProperty).toHaveBeenCalledWith(
        'deploy_type', environment.deployType
      );
    });

    it('should set global context exactly once (2 calls total)', () => {
      expect(
        (window.DD_LOGS!.setGlobalContextProperty as jest.Mock).mock.calls.length
      ).toBe(2);
    });

    it('should NOT throw when DD_LOGS is undefined', () => {
      delete window.DD_LOGS;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      expect(() => TestBed.inject(ObservabilityService)).not.toThrow();
    });
  });

  // ─── log() ───────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('should call DD_LOGS.logger.log with correct args for info severity', () => {
      service.log({ event_type: 'render_complete', severity: 'info', view_name: 'characters', duration_ms: 200 });
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'render_complete',
        expect.objectContaining({ event_type: 'render_complete', severity: 'info', view_name: 'characters', duration_ms: 200 }),
        'info'
      );
    });

    it('should map severity "warning" to DD level "warn"', () => {
      service.log({ event_type: 'latency', severity: 'warning', duration_ms: 6000 });
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith('latency', expect.anything(), 'warn');
    });

    it('should map severity "error" to DD level "error"', () => {
      service.log({ event_type: 'request_error', severity: 'error', http_status: 500 });
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith('request_error', expect.anything(), 'error');
    });

    it('should not throw when DD_LOGS is undefined', () => {
      delete window.DD_LOGS;
      expect(() => service.log({ event_type: 'js_error', severity: 'error' })).not.toThrow();
    });
  });

  // ─── startTimer + logViewReady (caminho normal) ───────────────────────────

  describe('startTimer() + logViewReady() — caminho normal', () => {
    it('should log render_complete when duration <= 5000ms', () => {
      jest.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1300);
      service.startTimer('characters');
      service.logViewReady('characters');
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'render_complete',
        expect.objectContaining({ event_type: 'render_complete', severity: 'info', duration_ms: 300, threshold_exceeded: false }),
        'info'
      );
    });

    it('should log latency when duration > 5000ms (dados chegaram, mas devagar)', () => {
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(6000);
      service.startTimer('films');
      service.logViewReady('films');
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'latency',
        expect.objectContaining({ event_type: 'latency', severity: 'warning', duration_ms: 6000, threshold_exceeded: true }),
        'warn'
      );
    });

    it('should return silently when logViewReady called without startTimer', () => {
      service.logViewReady('unknown-view');
      expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should clear the timer after logViewReady so a second call does nothing', () => {
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');
      service.logViewReady('characters');
      jest.clearAllMocks();
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      service.logViewReady('characters');
      expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();
    });

    it('should support independent timers for multiple simultaneous views', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(500);
      service.startTimer('characters');
      service.startTimer('films');
      service.logViewReady('characters');
      service.logViewReady('films');
      const calls = (window.DD_LOGS!.logger.log as jest.Mock).mock.calls;
      expect(calls[0][1]).toMatchObject({ view_name: 'characters', duration_ms: 200 });
      expect(calls[1][1]).toMatchObject({ view_name: 'films', duration_ms: 490 });
    });
  });

  // ─── timer_lost (auto-timeout) ────────────────────────────────────────────

  describe('timer_lost — auto-timeout após 5 s sem logViewReady', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should send timer_lost (not latency) when timeout fires — dados nunca chegaram', () => {
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(5001);
      service.startTimer('characters');

      jest.advanceTimersByTime(60000);

      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'timer_lost',
        expect.objectContaining({
          event_type: 'timer_lost',
          severity: 'error',
          view_name: 'characters',
          threshold_exceeded: true,
        }),
        'error'
      );
    });

    it('should send latency (not timer_lost) when logViewReady is called after 5s — dados chegaram tarde', () => {
      jest.useRealTimers();
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(6000);
      service.startTimer('characters');
      service.logViewReady('characters');
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'latency',
        expect.objectContaining({ event_type: 'latency', duration_ms: 6000 }),
        'warn'
      );
    });

    it('should NOT fire timer_lost if logViewReady is called before the timeout', () => {
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(300);
      service.startTimer('characters');
      service.logViewReady('characters');
      jest.advanceTimersByTime(60000);
      expect((window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length).toBe(1);
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith('render_complete', expect.anything(), 'info');
    });

    it('should reset the timeout when startTimer is called again (re-navegação)', () => {
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');

      jest.advanceTimersByTime(30000); // 30 s — timer original ainda não expirou
      service.startTimer('characters'); // re-navegação — cancela o anterior, novo ciclo de 60 s

      jest.advanceTimersByTime(30000); // 30 s do novo timer — ainda não expirou
      expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();

      jest.advanceTimersByTime(30001); // completa 60 s do novo timer
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledTimes(1);
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith('timer_lost', expect.anything(), 'error');
    });

    it('should not double-log when ngOnDestroy calls logViewReady after timer_lost already fired', () => {
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');

      jest.advanceTimersByTime(60000); // timer_lost dispara
      expect((window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length).toBe(1);

      service.logViewReady('characters'); // ngOnDestroy chama depois
      expect((window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length).toBe(1);
    });

    it('should return silently if timer was already cleared when _fireTimerLost fires (defensive guard)', () => {
      jest.useRealTimers();
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');
      service.logViewReady('characters'); // timer cleared
      jest.clearAllMocks();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      // Simulates the rare case where timeout callback fires after timer was already cleared
      (service as unknown as { _fireTimerLost: (v: string) => void })._fireTimerLost('characters');
      expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();
    });

    it('should handle multiple simultaneous timers — each fires timer_lost independently', () => {
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');
      service.startTimer('films');

      jest.advanceTimersByTime(60000);

      const calls = (window.DD_LOGS!.logger.log as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);
      const eventTypes = calls.map((c) => c[0] as string);
      expect(eventTypes).toEqual(expect.arrayContaining(['timer_lost', 'timer_lost']));
      const viewNames = calls.map((c) => (c[1] as Record<string, string>)['view_name']);
      expect(viewNames).toContain('characters');
      expect(viewNames).toContain('films');
    });
  });
});
