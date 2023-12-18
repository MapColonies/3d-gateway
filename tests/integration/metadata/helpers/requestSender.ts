import * as supertest from 'supertest';
import { UpdatePayload, UpdateStatusPayload } from '../../../../src/common/interfaces';

export class MetadataRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async updateMetadata(identifier: string, payload: UpdatePayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/metadata/update/${identifier}`).set('Content-Type', 'application/json').send(payload);
  }

  public async updateStatus(identifier: string, payload: UpdateStatusPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/metadata/update/status/${identifier}`).set('Content-Type', 'application/json').send(payload);
  }
}
