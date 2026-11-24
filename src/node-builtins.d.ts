// Minimal declarations for the Node built-ins used by this offline project.
declare module "node:sqlite" {
  type SqlValue = string | number | bigint | Uint8Array | null;
  interface Statement {
    run(...params: SqlValue[]): unknown;
    get(...params: SqlValue[]): Record<string, unknown> | undefined;
    all(...params: SqlValue[]): Record<string, unknown>[];
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}

declare module "node:crypto" {
  interface Hash {
    update(data: string, encoding: "utf8"): Hash;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: "sha256"): Hash;
}
