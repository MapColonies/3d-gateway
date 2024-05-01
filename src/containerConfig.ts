import config from 'config';
import { getOtelMixin } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instanceCachingFactory } from 'tsyringe';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import client from 'prom-client';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { modelRouterFactory, MODEL_ROUTER_SYMBOL } from './model/routes/modelRouter';
import { METADATA_ROUTER_SYMBOL, metadataRouterFactory } from './metadata/routes/metadataRouter';
import { getProvider, getProviderConfig } from './providers/getProviders';
import { Provider, ProviderConfig } from './common/interfaces';
import { IConfig } from './common/interfaces';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const provider = config.get<string>('provider');
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: MODEL_ROUTER_SYMBOL, provider: { useFactory: modelRouterFactory } },
    { token: METADATA_ROUTER_SYMBOL, provider: { useFactory: metadataRouterFactory } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instanceCachingFactory((container) => {
          const config = container.resolve<IConfig>(SERVICES.CONFIG);

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
        useFactory: (): ProviderConfig => {
          return getProviderConfig(provider);
        },
      },
    },
    {
      token: SERVICES.PROVIDER,
      provider: {
        useFactory: (): Provider => {
          return getProvider();
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
