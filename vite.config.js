import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        // Passamos o ficheiro de configuração explicitamente aqui
        tailwind('./tailwind.config.js'),
        autoprefixer,
      ],
    },
  },
})
