import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

/** Roblox usernames: 3–20 letters, numbers and underscores. */
export const robloxUsername = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, 'Enter your Roblox username: 3 to 20 letters, numbers or underscores.');

export const chirperHandle = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ''))
  .refine((v) => v === '' || /^[A-Za-z0-9_]{1,30}$/.test(v), 'Enter your Chirper handle without spaces, like KeysWithJohnson.')
  .transform((v) => v || null);

export const profileSchema = z.object({
  robloxUsername,
  chirperHandle,
  displayName: optionalText(60, 'Keep your display name under 60 characters.'),
});

export type ProfileInput = z.infer<typeof profileSchema>;
