/* eslint-disable @typescript-eslint/naming-convention */
import {
  CreateBucketCommandInput,
  CreateBucketCommand,
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  PutObjectCommandInput,
  DeleteBucketCommandInput,
  DeleteBucketCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommand,
  ListObjectsRequest,
  ListObjectsCommand,
  GetObjectCommandInput,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { randSentence } from '@ngneat/falso';
import { S3Config } from '../../src/common/interfaces';

export class S3Helper {
  private readonly s3: S3Client;

  public constructor(private readonly s3Config: S3Config) {
    const s3ClientConfig: S3ClientConfig = {
      endpoint: this.s3Config.endpointUrl,
      forcePathStyle: this.s3Config.forcePathStyle,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      region: this.s3Config.region,
    };
    this.s3 = new S3Client(s3ClientConfig);
  }

  public async initialize(): Promise<void> {
    await this.createBucket(this.s3Config.bucket);
  }

  public async terminate(): Promise<void> {
    await this.clearBucket(this.s3Config.bucket);
    await this.deleteBucket(this.s3Config.bucket);
  }

  public async createBucket(bucket: string): Promise<void> {
    const params: CreateBucketCommandInput = {
      Bucket: bucket,
    };
    await this.s3.send(new CreateBucketCommand(params));
  }

  public async deleteBucket(bucket = this.s3Config.bucket): Promise<void> {
    const params: DeleteBucketCommandInput = {
      Bucket: bucket,
    };
    const command = new DeleteBucketCommand(params);
    await this.s3.send(command);
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(randSentence());
    const params: PutObjectCommandInput = {
      Bucket: this.s3Config.bucket,
      Key: `${model}/${file}`,
      Body: data,
    };
    await this.s3.send(new PutObjectCommand(params));
    return data;
  }

  public async clearBucket(bucket = this.s3Config.bucket): Promise<void> {
    const params: ListObjectsRequest = {
      Bucket: bucket,
    };
    const listObject = new ListObjectsCommand(params);
    const data = await this.s3.send(listObject);
    if (data.Contents) {
      for (const dataContent of data.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(bucket, dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    const params: DeleteObjectCommandInput = {
      Bucket: bucket,
      Key: key,
    };
    const command = new DeleteObjectCommand(params);
    await this.s3.send(command);
  }

  public async readFile(bucket: string, key: string): Promise<Buffer | undefined> {
    const params: GetObjectCommandInput = {
      Bucket: bucket,
      Key: key,
    };
    const response = await this.s3.send(new GetObjectCommand(params));
    return response.Body?.transformToString() as unknown as Buffer;
  }

  public killS3(): void {
    this.s3.destroy();
  }
}
