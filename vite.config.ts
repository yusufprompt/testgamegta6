import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths make the build portable for GitHub Pages subpaths.
  base: './',
  plugins: [react()],
})
