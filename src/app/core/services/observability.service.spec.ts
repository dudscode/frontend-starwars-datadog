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

  describe('constructor — global context setup', () => {
    it('should set app_version and deploy_type when DD_LOGS exists', () => {
      expect(window.DD_LOGS!.setGlobalContextProperty).toHaveBeenCalledWith(
        'app_version',
        environment.appVersion
      );
      expect(window.DD_LOGS!.setGlobalContextProperty).toHaveBeenCalledWith(
        'deploy_type',
        environment.deployType
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
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'latency',
        expect.objectContaining({ severity: 'warning' }),
        'warn'
      );
    });

    it('should map severity "error" to DD level "error"', () => {
      service.log({ event_type: 'request_error', severity: 'error', http_status: 500 });
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'request_error',
        expect.objectContaining({ severity: 'error' }),
        'error'
      );
    });

    it('should not throw when DD_LOGS is undefined', () => {
      delete window.DD_LOGS;
      expect(() => service.log({ event_type: 'js_error', severity: 'error' })).not.toThrow();
    });
  });

  describe('startTimer() + logViewReady()', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should log render_complete when duration <= 5000ms', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)  // startTimer
        .mockReturnValueOnce(1300); // logViewReady → 300ms

      service.startTimer('characters');
      service.logViewReady('characters');

      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'render_complete',
        expect.objectContaining({
          event_type: 'render_complete',
          severity: 'info',
          view_name: 'characters',
          duration_ms: 300,
          threshold_exceeded: false,
        }),
        'info'
      );
    });

    it('should log latency when duration > 5000ms', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(6000);

      service.startTimer('films');
      service.logViewReady('films');

      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'latency',
        expect.objectContaining({
          event_type: 'latency',
          severity: 'warning',
          view_name: 'films',
          duration_ms: 6000,
          threshold_exceeded: true,
        }),
        'warn'
      );
    });

    it('should return silently when logViewReady called without startTimer (no double-log from ngOnDestroy)', () => {
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

      service.logViewReady('characters'); // second call — no timer
      expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();
    });

    it('should support independent timers for different views', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)    // startTimer('characters')
        .mockReturnValueOnce(10)   // startTimer('films')
        .mockReturnValueOnce(200)  // logViewReady('characters')
        .mockReturnValueOnce(500); // logViewReady('films')

      service.startTimer('characters');
      service.startTimer('films');
      service.logViewReady('characters');
      service.logViewReady('films');

      const calls = (window.DD_LOGS!.logger.log as jest.Mock).mock.calls;
      expect(calls[0][1]).toMatchObject({ view_name: 'characters', duration_ms: 200 });
      expect(calls[1][1]).toMatchObject({ view_name: 'films', duration_ms: 490 });
    });
  });

  describe('auto-timeout — disparo automático após 5 s', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should fire logViewReady automatically after LATENCY_THRESHOLD_MS', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)     // startTimer: marca o início
        .mockReturnValueOnce(5001); // logViewReady auto: calcula duração
      service.startTimer('characters');

      jest.advanceTimersByTime(5000);

      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'latency',
        expect.objectContaining({
          event_type: 'latency',
          severity: 'warning',
          view_name: 'characters',
          threshold_exceeded: true,
        }),
        'warn'
      );
    });

    it('should NOT double-log if logViewReady is called before the timeout', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)    // startTimer
        .mockReturnValueOnce(300); // logViewReady

      service.startTimer('characters');
      service.logViewReady('characters'); // cancels the timeout

      jest.advanceTimersByTime(5000); // timeout would have fired here

      expect((window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length).toBe(1);
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'render_complete', expect.anything(), 'info'
      );
    });

    it('should emit a new timeout if startTimer is called again for the same view', () => {
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');

      jest.advanceTimersByTime(3000); // not yet expired
      service.startTimer('characters'); // re-navigação: reseta o timer

      jest.advanceTimersByTime(3000); // 3s do novo timer — ainda não expirou

      expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2000); // completa 5s do novo timer

      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledTimes(1);
    });

    it('should not double-log when ngOnDestroy calls logViewReady after auto-timeout already fired', () => {
      jest.spyOn(performance, 'now').mockReturnValue(0);
      service.startTimer('characters');

      jest.advanceTimersByTime(5000); // auto-timeout fires
      expect((window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length).toBe(1);

      service.logViewReady('characters'); // ngOnDestroy chama depois
      expect((window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length).toBe(1); // ainda 1
    });
  });
});
