import * as supertest from 'supertest';
import { IngestionPayload } from '../../../../src/common/interfaces';

export class ModelRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async createModel(payload: IngestionPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/models').set('Content-Type', 'application/json').send(payload);
  }
}
