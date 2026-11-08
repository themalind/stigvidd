import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function packages(...names: string[]) {
  return new RegExp(`[\\\\/]node_modules[\\\\/](${names.join("|")})[\\\\/]`);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: packages("react", "react-dom", "react-router", "scheduler") },
            {
              name: "tanstack",
              test: packages(
                "@tanstack/react-query",
                "@tanstack/query-core",
                "@tanstack/react-table",
                "@tanstack/table-core",
              ),
            },
            { name: "radix", test: packages("radix-ui", "@radix-ui/[^\\\\/]+") },
            { name: "icons", test: packages("lucide-react") },
            // Only fetched on the mail-template route, which is lazy-loaded.
            { name: "editor", test: packages("@tiptap/[^\\\\/]+", "prosemirror-[^\\\\/]+") },
          ],
        },
      },
    },
  },
});
