import {
  S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand, CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PassThrough, Readable } from "node:stream";
import type { ObjectMetadata, StorageFile } from "./storageFile";

const METADATA_KEY = "moodboard-metadata";
let client: S3Client | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing object storage configuration: ${name}`);
  return value;
}

export function getS3Client(): S3Client {
  return client ??= new S3Client({
    endpoint: required("S3_ENDPOINT"),
    region: process.env.S3_REGION || "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });
}

function checkBucket(bucket: string) {
  if (bucket !== required("S3_BUCKET")) throw new Error("Unexpected object storage bucket");
}

function decodeMetadata(value?: string): Record<string, string> {
  return value ? JSON.parse(Buffer.from(value, "base64").toString("utf8")) : {};
}

export class S3StorageFile implements StorageFile {
  constructor(private readonly bucket: string, public readonly name: string) {
    checkBucket(bucket);
  }

  async exists(): Promise<[boolean]> {
    try {
      await getS3Client().send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }));
      return [true];
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) return [false];
      throw error;
    }
  }

  async getMetadata(): Promise<[ObjectMetadata]> {
    const result = await getS3Client().send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }));
    return [{
      contentType: result.ContentType,
      size: result.ContentLength,
      metadata: decodeMetadata(result.Metadata?.[METADATA_KEY]),
    }];
  }

  async setMetadata(value: { metadata?: Record<string, string> }): Promise<void> {
    const original = await getS3Client().send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }));
    const metadata = { ...decodeMetadata(original.Metadata?.[METADATA_KEY]), ...value.metadata };
    await getS3Client().send(new CopyObjectCommand({
      Bucket: this.bucket, Key: this.name,
      CopySource: encodeURIComponent(`${this.bucket}/${this.name}`).replace(/%2F/g, "/"),
      CopySourceIfMatch: original.ETag,
      MetadataDirective: "REPLACE",
      ContentType: original.ContentType,
      CacheControl: original.CacheControl,
      ContentDisposition: original.ContentDisposition,
      Metadata: { ...original.Metadata, [METADATA_KEY]: Buffer.from(JSON.stringify(metadata)).toString("base64") },
    }));
  }

  async save(buffer: Buffer, options: { contentType?: string; resumable?: boolean } = {}): Promise<void> {
    await getS3Client().send(new PutObjectCommand({
      Bucket: this.bucket, Key: this.name, Body: buffer, ContentType: options.contentType,
    }));
  }

  async download(): Promise<[Buffer]> {
    const result = await getS3Client().send(new GetObjectCommand({ Bucket: this.bucket, Key: this.name }));
    if (!result.Body) throw new Error("Object has no body");
    return [Buffer.from(await result.Body.transformToByteArray())];
  }

  createReadStream(): Readable {
    const output = new PassThrough();
    void getS3Client().send(new GetObjectCommand({ Bucket: this.bucket, Key: this.name }))
      .then(result => {
        if (!(result.Body instanceof Readable)) throw new Error("Object has no readable body");
        result.Body.on("error", error => output.destroy(error));
        result.Body.pipe(output);
      }).catch(error => output.destroy(error));
    return output;
  }
}

export const s3StorageClient = {
  bucket(bucket: string) {
    checkBucket(bucket);
    return { file: (name: string) => new S3StorageFile(bucket, name) };
  },
};

export async function signS3Upload(bucket: string, name: string): Promise<string> {
  checkBucket(bucket);
  return getSignedUrl(getS3Client(), new PutObjectCommand({ Bucket: bucket, Key: name }), { expiresIn: 900 });
}

export function objectKeyFromS3Url(raw: string): string | null {
  const url = new URL(raw);
  const endpoint = new URL(required("S3_ENDPOINT"));
  const bucket = required("S3_BUCKET");
  if (url.protocol !== endpoint.protocol || url.port !== endpoint.port) return null;
  if (url.hostname === `${bucket}.${endpoint.hostname}`) return decodeURIComponent(url.pathname.slice(1));
  const prefix = `${endpoint.pathname.replace(/\/$/, "")}/${bucket}/`;
  if (url.hostname === endpoint.hostname && url.pathname.startsWith(prefix)) {
    return decodeURIComponent(url.pathname.slice(prefix.length));
  }
  return null;
}
