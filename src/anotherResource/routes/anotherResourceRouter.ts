import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { AnotherResourceController } from '../controllers/anotherResourceController';

const anotherResourceRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(AnotherResourceController);

  router.get('/', controller.getResource);

  return router;
};

export const ANOTHER_RESOURECE_ROUTER_SYMBOL = Symbol('anotherResourceRouterFactory');

export { anotherResourceRouterFactory };
