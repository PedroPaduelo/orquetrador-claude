import { useRef, useCallback, useState } from 'react'
import { Image, X, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { Attachment } from '../types'

interface ImageUploaderProps {
  attachments: Attachment[]
  isUploading: boolean
  onAddFiles: (files: FileList | File[]) => Promise<Attachment[]>
  onRemove: (id: string) => void
  disabled?: boolean
}

export function ImageUploader({
  attachments,
  isUploading,
  onAddFiles,
  onRemove,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await onAddFiles(files)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [onAddFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragOver(true)
    }
  }, [disabled, isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled || isUploading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      await onAddFiles(files)
    }
  }, [disabled, isUploading, onAddFiles])

  return (
    <div
      className={cn(
        'relative',
        isDragOver && 'ring-2 ring-primary ring-offset-2 rounded-lg'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Upload button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleClick}
        disabled={disabled || isUploading}
        title="Anexar imagem"
        className="h-8 w-8 shrink-0"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Image className="h-4 w-4" />
        )}
      </Button>

      {/* Attachment previews - shown above input */}
      {attachments.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 right-0 flex flex-wrap gap-2 p-2 bg-background/95 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg">
          {attachments.map((att) => (
            <AttachmentPreview
              key={att.id}
              attachment={att}
              onRemove={() => onRemove(att.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AttachmentPreviewProps {
  attachment: Attachment
  onRemove: () => void
}

function getImageUrl(url: string): string {
  if (url.startsWith('http')) return url
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'
  return `${apiUrl}${url}`
}

function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  return (
    <div className="relative group">
      <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 bg-muted">
        <img
          src={getImageUrl(attachment.url)}
          alt={attachment.filename}
          className="w-full h-full object-cover"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
    </div>
  )
}
