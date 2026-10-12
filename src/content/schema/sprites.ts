import { z } from "zod";
import { ContentId, SchemaRef } from "@/content/schema/vocab";
import { ROLES } from "@/game/vocab";

const Pair = z.tuple([z.number(), z.number()]);

/** One creature or prop image in the atlas (written by scripts/build_atlas.py). */
export const SpriteDef = z.strictObject({
  id: ContentId,
  /** Art role: the player, a held prop, or an enemy role. */
  role: z.enum(["player", "prop", ...ROLES]),
  frame: z.string().min(1),
  px: Pair,
  world: Pair,
  /** Feet anchor (props: grip), 0..1 of the image. */
  pivot: Pair,
  flying: z.boolean(),
  grip: Pair.nullable(),
  owner: ContentId.nullable(),
});
export type SpriteDef = z.infer<typeof SpriteDef>;

/** One effect texture set: white fill + black ink, tintable at runtime when `tintable`. */
export const FxTexture = z.strictObject({
  id: ContentId,
  frames: z.array(z.string().min(1)).min(1),
  px: z.array(Pair).min(1),
  pivot: Pair,
  worldSize: z.number().positive(),
  tintable: z.boolean(),
});
export type FxTexture = z.infer<typeof FxTexture>;

export const Sprites = z.strictObject({
  $schema: SchemaRef,
  atlas: z.strictObject({ png: z.string().min(1), json: z.string().min(1) }),
  pxPerWorldUnit: z.number().positive(),
  sprites: z.array(SpriteDef),
  fx: z.array(FxTexture),
});
export type Sprites = z.infer<typeof Sprites>;
