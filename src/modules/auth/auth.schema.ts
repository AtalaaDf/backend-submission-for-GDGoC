import { z } from "zod";

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(["superadmin", "admin", "executive", "po"]),
});

export const loginBodySchema = z
  .object({
    email: z.string().email("Format email tidak valid."),
    password: z.string().min(1, "Kata sandi tidak boleh kosong."),
  })
  .strict();

export const loginResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    expiresIn: z.number(),
    user: userProfileSchema,
  }),
});

export const meResponseSchema = z.object({
  data: userProfileSchema,
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

