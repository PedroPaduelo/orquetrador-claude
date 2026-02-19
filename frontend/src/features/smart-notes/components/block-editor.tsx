import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Undo, Redo, Link as LinkIcon, Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

const lowlight = createLowlight(common)

interface BlockEditorProps {
  content: string
  onChange?: (html: string) => void
  readOnly?: boolean
  placeholder?: string
}

export function BlockEditor({ content, onChange, readOnly = false, placeholder = 'Comece a escrever...' }: BlockEditorProps) {
  const isSyncingRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        hardBreak: { keepMarks: true },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
        HTMLAttributes: { class: 'hljs' },
      }),
      Placeholder.configure({
        placeholder: readOnly ? '' : placeholder,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
    onUpdate: ({ editor: e }) => {
      // Skip onChange during programmatic content sync to prevent auto-save loops
      if (isSyncingRef.current) return
      onChange?.(e.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    // Normalize: Tiptap represents empty content as <p></p>
    const editorHtml = editor.getHTML()
    const isEmpty = (s: string) => !s || s === '<p></p>'
    if (isEmpty(content) && isEmpty(editorHtml)) return
    if (content !== editorHtml) {
      isSyncingRef.current = true
      editor.commands.setContent(content)
      isSyncingRef.current = false
    }
  }, [content, editor])

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [readOnly, editor])

  if (!editor) return null

  return (
    <div className="block-editor">
      {!readOnly && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// --- Toolbar ---

interface ToolbarItem {
  icon: LucideIcon
  action: () => void
  active?: boolean
  disabled?: boolean
  label: string
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const groups: ToolbarItem[][] = [
    [
      { icon: Undo, action: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo(), label: 'Desfazer' },
      { icon: Redo, action: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo(), label: 'Refazer' },
    ],
    [
      { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), label: 'H1' },
      { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), label: 'H2' },
      { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), label: 'H3' },
    ],
    [
      { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Negrito' },
      { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Itálico' },
      { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), label: 'Tachado' },
      { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), label: 'Código' },
    ],
    [
      { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Lista' },
      { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Lista numerada' },
      { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Citação' },
      { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), label: 'Divisor' },
    ],
    [
      {
        icon: LinkIcon,
        action: () => {
          const url = window.prompt('URL do link:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        },
        active: editor.isActive('link'),
        label: 'Link',
      },
      {
        icon: ImageIcon,
        action: () => {
          const url = window.prompt('URL da imagem:')
          if (url) editor.chain().focus().setImage({ src: url }).run()
        },
        label: 'Imagem',
      },
    ],
  ]

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b px-2 py-1.5 bg-muted/30">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-5 bg-border mx-1" />}
          {group.map((item, ii) => (
            <Button
              key={ii}
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', item.active && 'bg-muted text-foreground')}
              onClick={item.action}
              disabled={item.disabled}
              title={item.label}
              type="button"
            >
              <item.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  )
}
