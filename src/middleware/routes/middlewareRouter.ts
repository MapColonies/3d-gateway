import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { MiddlewareController } from '../controllers/middlewareController';

const middlewareRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(MiddlewareController);

  router.post('/ingestion', controller.createModel);
  router.post('/update/:identifier', controller.updateMetadata);
  router.post('/update/status/:identifier', controller.updateStatus);

  return router;
};

export const MIDDLEWARE_ROUTER_SYMBOL = Symbol('middlewareRouterFactory');

export { middlewareRouterFactory };
