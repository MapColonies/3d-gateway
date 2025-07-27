import * as supertest from 'supertest';
import { IngestionPayload, IngestionValidatePayload } from '../../../../src/common/interfaces';

export class ModelRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async createModel(payload: IngestionPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/models').set('Content-Type', 'application/json').send(payload);
  }

  public async validate(payload: IngestionValidatePayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/models/validate').set('Content-Type', 'application/json').send(payload);
  }

  public async validateDeleteById(id: string): Promise<supertest.Response> {
    return supertest.agent(this.app).get(`/models/canDelete/${id}`).set('Content-Type', 'application/json');
  }

  public async deleteModel(id: string): Promise<supertest.Response> {
    return supertest.agent(this.app).delete(`/models/${id}`).set('Content-Type', 'application/json');
  }
}
