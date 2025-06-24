import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { ModelController } from '../controllers/modelController';

const modelRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ModelController);

  router.post('/', controller.createModel);
  router.delete('/:identifier', controller.deleteModel);
  router.get('/canDelete/:identifier', controller.validateDelete);
  router.post('/validate', controller.validate.bind(controller));

  return router;
};

export const MODEL_ROUTER_SYMBOL = Symbol('modelRouterFactory');

export { modelRouterFactory };
