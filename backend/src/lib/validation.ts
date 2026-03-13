import { resolve } from 'path'
import { BadRequestError } from '../http/errors/index.js'

const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH || '/workspace/temp-orquestrador'

export function validateProjectPath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new BadRequestError('Project path is required')
  }
  // Block null bytes
  if (inputPath.includes('\0')) {
    throw new BadRequestError('Invalid project path: null bytes not allowed')
  }
  const resolved = resolve(inputPath)
  if (!resolved.startsWith(PROJECT_BASE_PATH)) {
    throw new BadRequestError(`Invalid project path: must be within ${PROJECT_BASE_PATH}`)
  }
  return resolved
}

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]

const BLOCKED_RANGES = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
]

export function validateMcpServerUrl(uri: string): void {
  if (!uri) return
  let hostname: string
  try {
    const url = new URL(uri)
    hostname = url.hostname
  } catch {
    throw new BadRequestError('Invalid URL format')
  }

  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new BadRequestError(`SSRF protection: ${hostname} is not allowed`)
  }

  for (const range of BLOCKED_RANGES) {
    if (range.test(hostname)) {
      throw new BadRequestError(`SSRF protection: private IP range ${hostname} is not allowed`)
    }
  }
}
