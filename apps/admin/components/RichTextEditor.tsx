"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { forwardRef, useImperativeHandle, useState } from "react";

function ToolbarButton({
  onClick,
  active,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`rounded-base px-2 py-1 text-sm font-medium ${
        active ? "bg-brand-primary text-white" : "hover:bg-surface-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-t-base border border-b-0 border-border bg-surface-muted p-2">
      <ToolbarButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        onClick={() => {
          const url = window.prompt("URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive("link")}
      >
        Link
      </ToolbarButton>
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>
    </div>
  );
}

export interface RichTextEditorHandle {
  setContent: (html: string) => void;
  /** Current editor content as plain text — used to ground AI tag/summary prompts in the article body. */
  getText: () => string;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, { name: string; initialContent?: string }>(
  function RichTextEditor({ name, initialContent }, ref) {
    const [html, setHtml] = useState(initialContent ?? "");

    const editor = useEditor({
      extensions: [StarterKit, Link.configure({ openOnClick: false })],
      content: initialContent ?? "",
      immediatelyRender: false,
      onUpdate: ({ editor }) => setHtml(editor.getHTML()),
      editorProps: {
        attributes: {
          class:
            "min-h-[300px] rounded-b-base border border-border bg-surface px-3 py-2 text-sm focus:outline-none [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-brand-primary [&_a]:underline",
        },
      },
    });

    useImperativeHandle(ref, () => ({
      setContent: (nextHtml: string) => {
        editor?.commands.setContent(nextHtml, true);
      },
      getText: () => editor?.getText() ?? "",
    }));

    if (!editor) {
      return <div className="min-h-[340px] animate-pulse rounded-base border border-border bg-surface-muted" />;
    }

    return (
      <div>
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
        <input type="hidden" name={name} value={html} />
      </div>
    );
  }
);
