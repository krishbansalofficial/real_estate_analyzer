import { z } from "zod";

// Bounds match the cleaning rules in ml/train.py: the trees can't
// extrapolate, so inputs outside the training data are rejected, not guessed.
export const predictSchema = z.object({
  bed: z.number().int().min(1).max(12),
  bath: z.number().min(1).max(12),
  house_size: z.number().min(300).max(15_000),
  acre_lot: z.number().min(0).max(200).nullish(),
  zip_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "zip_code must be 5 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(60).optional(),
});
