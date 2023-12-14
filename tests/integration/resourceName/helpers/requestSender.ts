import * as supertest from 'supertest';

export class ResourceNameRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getResource(): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/resourceName').set('Content-Type', 'application/json');
  }

  public async createResource(): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/resourceName').set('Content-Type', 'application/json');
  }
}
