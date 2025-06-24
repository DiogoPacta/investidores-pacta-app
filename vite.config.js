import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Esta é a configuração padrão do Vite. Ele encontrará e usará 
// automaticamente o postcss.config.js.
export default defineConfig({
  plugins: [react()],
})
