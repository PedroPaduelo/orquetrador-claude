import { writeFile, mkdir, copyFile, unlink, access } from 'fs/promises'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'

export interface UploadResult {
  id: string
  filename: string
  mimeType: string
  size: number
  path: string        // relative path inside uploads dir
  projectPath: string // absolute path inside the project (for Claude CLI)
  url: string         // URL to serve the file
}

export interface UploadOptions {
  conversationId: string
  projectPath?: string
  file: {
    filename: string
    mimeType: string
    data: Buffer
  }
}

// Allowed image mime types
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Upload directory (relative to backend root) - serves via static
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'images')

export class UploadService {
  private ensureUploadDir: Promise<void> | null = null

  constructor() {
    this.ensureUploadDir = this.createUploadDir()
  }

  private async createUploadDir(): Promise<void> {
    try {
      await access(UPLOAD_DIR)
    } catch {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }
  }

  async uploadImage(options: UploadOptions): Promise<UploadResult> {
    await this.ensureUploadDir

    const { conversationId, projectPath, file } = options

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
      throw new Error(`Tipo de arquivo nao permitido: ${file.mimeType}. Use PNG, JPG, GIF ou WebP.`)
    }

    // Validate file size
    if (file.data.length > MAX_FILE_SIZE) {
      throw new Error(`Arquivo muito grande: ${(file.data.length / 1024 / 1024).toFixed(2)}MB. Maximo: 10MB.`)
    }

    // Generate unique filename
    const id = randomUUID()
    const ext = extname(file.filename) || '.png'
    const timestamp = Date.now()
    const safeFilename = `${timestamp}_${id.substring(0, 8)}${ext}`

    // 1) Save to uploads dir (for serving via static)
    const conversationDir = join(UPLOAD_DIR, conversationId)
    await mkdir(conversationDir, { recursive: true })
    const uploadsFilePath = join(conversationDir, safeFilename)
    await writeFile(uploadsFilePath, file.data)

    // 2) Also copy to project path so Claude CLI can access it
    let finalProjectPath = uploadsFilePath
    if (projectPath) {
      const projectImagesDir = join(projectPath, '.claude-images')
      try {
        await mkdir(projectImagesDir, { recursive: true })
        const projectFilePath = join(projectImagesDir, safeFilename)
        await copyFile(uploadsFilePath, projectFilePath)
        finalProjectPath = projectFilePath
      } catch (err) {
        // If copy fails, fall back to uploads path
        console.log(`[UploadService] Could not copy to project path: ${err}`)
      }
    }

    const relativePath = `${conversationId}/${safeFilename}`
    const url = `/uploads/images/${relativePath}`

    return {
      id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.data.length,
      path: relativePath,
      projectPath: finalProjectPath,
      url,
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = join(UPLOAD_DIR, relativePath)
    try {
      await unlink(fullPath)
    } catch {
      // Ignore if file doesn't exist
    }
  }

  getFullPath(relativePath: string): string {
    return join(UPLOAD_DIR, relativePath)
  }
}

export const uploadService = new UploadService()
