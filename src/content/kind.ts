import type { z } from "zod";

/** One content kind: a folder of files (collection) or a single file, and its schema. */
export interface Kind<T> {
  path: string;
  schemaName: string;
  schema: z.ZodType<T>;
  collection: boolean;
}

/** A kind, keeping whether it is a collection in its type (`Content`'s types follow it). */
export function kind<T, C extends boolean>(
  path: string,
  schemaName: string,
  schema: z.ZodType<T>,
  collection: C,
): Kind<T> & { collection: C } {
  return { path, schemaName, schema, collection };
}

/** Kinds by the key they compile to; a nested object compiles to a nested object. */
export interface KindTree {
  readonly [key: string]: Kind<unknown> | KindTree;
}

export function isKind(node: Kind<unknown> | KindTree): node is Kind<unknown> {
  return "schema" in node;
}

/** What a kind tree compiles to: a collection is keyed by id (the file name), a file is its value. */
export type Compiled<T> = T extends { schema: z.ZodType; collection: infer C }
  ? C extends true
    ? Record<string, z.output<T["schema"]>>
    : z.output<T["schema"]>
  : { [K in keyof T]: Compiled<T[K]> };
