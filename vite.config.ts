import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: 'local-development-boundary',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next()
          const host = req.headers.host
          const origin = req.headers.origin
          if (
            !['127.0.0.1:1420', 'localhost:1420'].includes(host || '') ||
            (origin && !['http://127.0.0.1:1420', 'http://localhost:1420'].includes(origin))
          ) {
            res.writeHead(403, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ error: 'Development request origin or host rejected' }))
          }
          if (!process.env.STYLEDNA_BACKEND_URL) {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            return res.end(
              JSON.stringify({ error: 'Start the full development launcher with pnpm dev.' }),
            )
          }
          next()
        })
      },
    },
  ],
  server: {
    warmup: { clientFiles: ['./src/main.tsx', './src/pages/*.tsx'] },
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    cors: false,
    proxy: process.env.STYLEDNA_BACKEND_URL
      ? {
          '/api': {
            target: process.env.STYLEDNA_BACKEND_URL,
            changeOrigin: true,
            configure(proxy) {
              proxy.on('proxyReq', (request) => {
                request.setHeader('Authorization', `Bearer ${process.env.STYLEDNA_BACKEND_TOKEN}`)
              })
            },
          },
        }
      : undefined,
  },
  clearScreen: false,
  build: { target: 'es2022' },
})
