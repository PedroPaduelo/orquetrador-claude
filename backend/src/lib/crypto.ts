import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { env } from './env.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 16

function getKey(salt: Buffer): Buffer {
  const secret = env.ENCRYPTION_KEY || env.JWT_SECRET
  return scryptSync(secret, salt, 32)
}

export function encrypt(text: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = getKey(salt)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: salt:iv:tag:encrypted (all base64)
  return [salt, iv, tag, encrypted].map(b => b.toString('base64')).join(':')
}

export function decrypt(data: string): string {
  const parts = data.split(':')
  if (parts.length !== 4) {
    // Not encrypted (legacy plaintext), return as-is
    return data
  }
  try {
    const [salt, iv, tag, encrypted] = parts.map(p => Buffer.from(p, 'base64'))
    const key = getKey(salt)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    // Decryption failed, might be legacy plaintext
    return data
  }
}
