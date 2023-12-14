import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';

const resourceInstance: IResourceNameModel = {
  id: 1,
  name: 'ronin',
  description: 'can you do a logistics run?',
};

function generateRandomId(): number {
  const rangeOfIds = 100;
  return Math.floor(Math.random() * rangeOfIds);
}
export interface IResourceNameModel {
  id?: number;
  name: string;
  description: string;
}

@injectable()
export class ResourceNameManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public getResource(): IResourceNameModel {
    this.logger.info({ msg: 'getting resource', resourceId: resourceInstance.id });

    return resourceInstance;
  }

  public createResource(resource: IResourceNameModel): IResourceNameModel {
    const resourceId = generateRandomId();

    this.logger.info({ msg: 'creating resource', resourceId });

    return { id: resourceId, ...resource };
  }
}
