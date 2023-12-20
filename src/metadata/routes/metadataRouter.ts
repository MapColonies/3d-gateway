import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { MetadataController } from '../controllers/metadataController';

const metadataRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(MetadataController);

  router.patch('/:identifier', controller.updateMetadata);
  router.patch('/status/:identifier', controller.updateStatus);

  return router;
};

export const METADATA_ROUTER_SYMBOL = Symbol('metadataRouterFactory');

export { metadataRouterFactory };
