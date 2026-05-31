import { Injector } from '@angular/core';
import { GlobalErrorHandler } from './global-error.handler';
import { ObservabilityService } from '../services/observability.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let obsMock: jest.Mocked<Pick<ObservabilityService, 'log'>>;
  let injectorMock: jest.Mocked<Pick<Injector, 'get'>>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    obsMock = { log: jest.fn() };
    injectorMock = { get: jest.fn().mockReturnValue(obsMock) };
    handler = new GlobalErrorHandler(injectorMock as unknown as Injector);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should always call console.error with the error', () => {
    const err = new Error('test error');
    handler.handleError(err);
    expect(consoleErrorSpy).toHaveBeenCalledWith(err);
  });

  it('should call obs.log with js_error and error.message for Error objects', () => {
    handler.handleError(new Error('something went wrong'));
    expect(obsMock.log).toHaveBeenCalledWith({
      event_type: 'js_error',
      severity: 'error',
      error_message: 'something went wrong',
    });
  });

  it('should call obs.log with String(value) for non-Error thrown values', () => {
    handler.handleError('plain string error');
    expect(obsMock.log).toHaveBeenCalledWith({
      event_type: 'js_error',
      severity: 'error',
      error_message: 'plain string error',
    });
  });

  it('should call obs.log with String(value) for thrown objects', () => {
    handler.handleError({ code: 42 });
    expect(obsMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'js_error', severity: 'error' })
    );
  });

  it('should NOT throw when Injector.get throws (service unavailable)', () => {
    injectorMock.get.mockImplementation(() => { throw new Error('DI not ready'); });
    expect(() => handler.handleError(new Error('early error'))).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
