import { z } from "zod";

/** The `$schema` every content file starts with (checked against its path by the compiler). */
export const SchemaRef = z.string().min(1);

/** Content ids and palette names: kebab-case, the same as file names. */
export const ContentId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are kebab-case");
