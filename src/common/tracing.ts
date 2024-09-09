import config from 'config';
import { Tracing } from '@map-colonies/telemetry';
import { context } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { SEMRESATTRS_PROCESS_RUNTIME_NAME, SEMRESATTRS_PROCESS_RUNTIME_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NODE_VERSION } from './constants';

const contextManager = new AsyncHooksContextManager();
contextManager.enable();
context.setGlobalContextManager(contextManager);

export const tracing = new Tracing(
  [new HttpInstrumentation({ requireParentforOutgoingSpans: true })],
  {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '@opentelemetry/instrumentation-express': { enabled: false },
  },
  { [SEMRESATTRS_PROCESS_RUNTIME_NAME]: 'nodejs', [SEMRESATTRS_PROCESS_RUNTIME_VERSION]: NODE_VERSION },
  config.get<string>('telemetry.logger.level').toLowerCase() === 'debug'
);
