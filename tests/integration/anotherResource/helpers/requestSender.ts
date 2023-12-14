import * as supertest from 'supertest';

export class AnotherResourceRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getResource(): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/anotherResource').set('Content-Type', 'application/json');
  }
}
