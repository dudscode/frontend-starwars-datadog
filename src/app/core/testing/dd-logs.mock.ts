import type { DdLogsInstance } from '../types/dd-logs.types';

export function createDdLogsMock(): DdLogsInstance {
  return {
    setGlobalContextProperty: jest.fn(),
    logger: {
      log: jest.fn(),
    },
  };
}

export function setupDdLogsMock(): void {
  beforeEach(() => {
    window.DD_LOGS = createDdLogsMock();
  });

  afterEach(() => {
    delete window.DD_LOGS;
  });
}
