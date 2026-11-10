import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Local-disk storage. File names are random UUIDs; user-supplied names are never used in paths. */
export class FileStorage {
  constructor(private readonly dir: string) {}

  async save(buf: Buffer, ext: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(this.dir, name), buf, { mode: 0o600 });
    return name;
  }

  read(name: string): Promise<Buffer> {
    return readFile(this.resolve(name));
  }

  remove(name: string): Promise<void> {
    return rm(this.resolve(name), { force: true });
  }

  private resolve(name: string): string {
    const full = path.resolve(this.dir, name);
    if (path.dirname(full) !== path.resolve(this.dir)) throw new Error("Invalid storage path");
    return full;
  }
}
