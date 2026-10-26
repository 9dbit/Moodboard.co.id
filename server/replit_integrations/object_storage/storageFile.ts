import type { Readable } from "node:stream";

export interface ObjectMetadata {
  contentType?: string;
  size?: string | number;
  metadata?: Record<string, string>;
}

export interface StorageFile {
  readonly name: string;
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[ObjectMetadata]>;
  setMetadata(value: { metadata?: Record<string, string> }): Promise<void>;
  save(buffer: Buffer, options?: { contentType?: string; resumable?: boolean }): Promise<void>;
  download(): Promise<[Buffer]>;
  createReadStream(): Readable;
}
