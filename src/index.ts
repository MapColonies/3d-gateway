// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'node:http';
import { createTerminus } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { ConfigType } from './common/config';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';
import { getApp } from './app';

void getApp()
.then((app) => {
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const port = config.get('server.port') || DEFAULT_SERVER_PORT;
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const stubHealthCheck = async (): Promise<void> => Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const server = createTerminus(createServer(app), { healthChecks: { '/liveness': stubHealthCheck, onSignal: container.resolve('onSignal') } });

  server.listen(port, () => {
    logger.info({ msg: `app started on port ${port}` });
  });
})
.catch((error: Error) => {
  console.error('😢 - failed initializing the server');
  console.error(error);
});
