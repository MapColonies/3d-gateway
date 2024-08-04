import * as supertest from 'supertest';
import { IngestionPayload, IngestionSourcesPayload } from '../../../../src/common/interfaces';

export class ModelRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async createModel(payload: IngestionPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/models').set('Content-Type', 'application/json').send(payload);
  }

  public async validate(payload: IngestionPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/models/validate').set('Content-Type', 'application/json').send(payload);
  }

  public async validateSources(payload: IngestionSourcesPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/models/validateSources').set('Content-Type', 'application/json').send(payload);
  }
}
