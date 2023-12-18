import * as supertest from 'supertest';
import { IngestionPayload, UpdatePayload, UpdateStatusPayload } from '../../../../src/common/interfaces';

export class MiddlewareRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async createModel(payload: IngestionPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/ingestion').set('Content-Type', 'application/json').send(payload);
  }

  public async updateMetadata(identifier: string, payload: UpdatePayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/update/${identifier}`).set('Content-Type', 'application/json').send(payload);
  }

  public async updateStatus(identifier: string, payload: UpdateStatusPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/update/status/${identifier}`).set('Content-Type', 'application/json').send(payload);
  }
}
