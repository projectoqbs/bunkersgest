import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 500,
      binaryInterval: 1000,
      ignored: ['**/node_modules/**'],
    },
    hmr: true,
  },
})
