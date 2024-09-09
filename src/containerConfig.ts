import config from 'config';
import { getOtelMixin } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instanceCachingFactory } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import client from 'prom-client';
import { commonNfsV1Type, commonS3FullV1Type } from '@map-colonies/schemas';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { modelRouterFactory, MODEL_ROUTER_SYMBOL } from './model/routes/modelRouter';
import { METADATA_ROUTER_SYMBOL, metadataRouterFactory } from './metadata/routes/metadataRouter';
import { getProvider } from './providers/getProviders';
import { Provider } from './common/interfaces';
import { getConfig } from './common/config';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const configInstance = getConfig();

  const storage = configInstance.get('storage');
  const loggerConfig = configInstance.get('telemetry.logger');
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: MODEL_ROUTER_SYMBOL, provider: { useFactory: modelRouterFactory } },
    { token: METADATA_ROUTER_SYMBOL, provider: { useFactory: metadataRouterFactory } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instanceCachingFactory(() => {
          if (config.get<boolean>('telemetry.metrics.enabled')) {
            client.register.setDefaultLabels({
              app: SERVICE_NAME,
            });
            return client.register;
          }
        }),
      },
    },
    {
      token: SERVICES.PROVIDER_CONFIG,
      provider: {
        useFactory: (): commonS3FullV1Type | commonNfsV1Type => {
          return storage.config;
        },
      },
    },
    {
      token: SERVICES.PROVIDER,
      provider: {
        useFactory: (): Provider => {
          return getProvider(storage.provider);
        },
      },
    },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
