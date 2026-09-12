import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router"],
          "tanstack": ["@tanstack/react-query", "@tanstack/react-table"],
          "radix": ["radix-ui"],
          "icons": ["lucide-react"],
          // Only fetched on the mail-template route, which is lazy-loaded. "@tiptap/pm" is
          // deliberately absent: it is a namespace package with subpath exports only and no
          // "." entry, so listing it here fails the build outright. Its prosemirror modules
          // follow their importers into this chunk anyway.
          "editor": [
            "@tiptap/core",
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-link",
          ],
        },
      },
    },
  },
})
