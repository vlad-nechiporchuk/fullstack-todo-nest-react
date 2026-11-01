import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    // Same-origin in development too, as behind nginx in Docker: the browser never needs CORS.
    proxy: { "/api": "http://localhost:3001" },
  },
})
