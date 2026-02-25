import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().default('development-secret-change-in-production'),
  DATABASE_URL: z.string(),
  MAX_FILE_SIZE: z.coerce.number().default(26214400), // 25MB
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Invalid environment variables:')
  console.error(_env.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = _env.data
