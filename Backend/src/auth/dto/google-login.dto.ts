import { z } from 'zod';
import { parseZodHttp } from '../../http/zod-parser.js';

const googleLoginSchema = z.object({ credential: z.string().min(1).max(16_384) }).strict();

export type GoogleLoginDto = z.output<typeof googleLoginSchema>;

export const parseGoogleLoginDto = (input: unknown) => parseZodHttp(googleLoginSchema, input);
