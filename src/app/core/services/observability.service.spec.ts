import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ObservabilityService } from './observability.service';
import { setupDdLogsMock } from '../testing/dd-logs.mock';
import { environment } from '../../../environments/environment';

describe('ObservabilityService', () => {
  setupDdLogsMock();

  let service: ObservabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ObservabilityService);
  });

  describe('constructor — global context setup', () => {
    it('should set app_version and deploy_type global context when DD_LOGS exists', () => {
      expect(window.DD_LOGS!.setGlobalContextProperty).toHaveBeenCalledWith(
        'app_version',
        environment.appVersion
      );
      expect(window.DD_LOGS!.setGlobalContextProperty).toHaveBeenCalledWith(
        'deploy_type',
        environment.deployType
      );
    });

    it('should set global context exactly once', () => {
      expect(
        (window.DD_LOGS!.setGlobalContextProperty as jest.Mock).mock.calls.length
      ).toBe(2);
    });

    it('should NOT call setGlobalContextProperty when DD_LOGS is undefined', () => {
      delete window.DD_LOGS;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const svc = TestBed.inject(ObservabilityService);
      expect(svc).toBeTruthy();
      // No error thrown, setGlobalContextProperty not called (DD_LOGS was undefined)
    });
  });

  describe('log()', () => {
    it('should call DD_LOGS.logger.log with event_type, payload, and "info" level for info severity', () => {
      service.log({ event_type: 'render_complete', severity: 'info', view_name: 'characters', duration_ms: 200 });
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'render_complete',
        expect.objectContaining({ event_type: 'render_complete', severity: 'info', view_name: 'characters', duration_ms: 200 }),
        'info'
      );
    });

    it('should map severity "warning" to DD level "warn"', () => {
      service.log({ event_type: 'latency', severity: 'warning', duration_ms: 6000, threshold_exceeded: true });
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

    it('should spread all payload fields into the context object', () => {
      const payload = { event_type: 'js_error' as const, severity: 'error' as const, error_message: 'boom' };
      service.log(payload);
      expect(window.DD_LOGS!.logger.log).toHaveBeenCalledWith(
        'js_error',
        expect.objectContaining({ event_type: 'js_error', error_message: 'boom' }),
        'error'
      );
    });

    it('should return immediately (no error) when DD_LOGS is undefined', () => {
      delete window.DD_LOGS;
      expect(() => service.log({ event_type: 'js_error', severity: 'error' })).not.toThrow();
    });
  });

  describe('watchView()', () => {
    beforeEach(() => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)   // start time
        .mockReturnValueOnce(300); // end time (300ms)
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log render_complete with threshold_exceeded: false when duration <= 5000ms', (done) => {
      jest.restoreAllMocks();
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(300);
      const subject = new Subject<string | null>();
      service.watchView('characters', subject.asObservable());
      subject.next('data');
      setTimeout(() => {
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
        done();
      }, 0);
    });

    it('should log latency with threshold_exceeded: true when duration > 5000ms', (done) => {
      jest.restoreAllMocks();
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(6000);
      const subject = new Subject<string | null>();
      service.watchView('films', subject.asObservable());
      subject.next('data');
      setTimeout(() => {
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
        done();
      }, 0);
    });

    it('should NOT log when null is emitted (startWith(null) case)', (done) => {
      jest.restoreAllMocks();
      jest.spyOn(performance, 'now').mockReturnValue(0);
      const subject = new Subject<string | null>();
      service.watchView('characters', subject.asObservable());
      subject.next(null);
      setTimeout(() => {
        expect(window.DD_LOGS!.logger.log).not.toHaveBeenCalled();
        done();
      }, 0);
    });

    it('should log exactly once even if source emits multiple non-null values', (done) => {
      jest.restoreAllMocks();
      jest.spyOn(performance, 'now').mockReturnValue(0);
      const subject = new Subject<string | null>();
      service.watchView('characters', subject.asObservable());
      subject.next('first');
      subject.next('second');
      subject.next('third');
      setTimeout(() => {
        const logCalls = (window.DD_LOGS!.logger.log as jest.Mock).mock.calls.length;
        expect(logCalls).toBe(1);
        done();
      }, 0);
    });
  });
});
