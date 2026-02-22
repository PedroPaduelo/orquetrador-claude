import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Attachment } from '../types'

interface UseImageUploadOptions {
  conversationId: string
  maxFileSize?: number // in bytes
  allowedTypes?: string[]
}

const DEFAULT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function useImageUpload(options: UseImageUploadOptions) {
  const { conversationId, maxFileSize = DEFAULT_MAX_FILE_SIZE, allowedTypes = DEFAULT_ALLOWED_TYPES } = options
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    // Validate all files first
    const validFiles: File[] = []
    for (const file of fileArray) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo de arquivo nao permitido: ${file.type}`)
        continue
      }
      if (file.size > maxFileSize) {
        toast.error(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximo: ${maxFileSize / 1024 / 1024}MB`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return []

    setIsUploading(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
      const formData = new FormData()
      for (const file of validFiles) {
        formData.append('file', file)
      }

      const response = await fetch(`${apiUrl}/conversations/${conversationId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Upload failed')
      }

      const result = await response.json() as { files: Attachment[] }
      const uploaded = result.files || []

      if (uploaded.length > 0) {
        setAttachments(prev => [...prev, ...uploaded])
      }

      return uploaded
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer upload')
      return []
    } finally {
      setIsUploading(false)
    }
  }, [conversationId, maxFileSize, allowedTypes])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  return {
    attachments,
    isUploading,
    addFiles,
    removeAttachment,
    clearAttachments,
  }
}
