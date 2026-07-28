import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://api.emat.metaversedu.in'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Dev-only proxy: forwards /emat/* to the backend so the browser never
      // sees a cross-origin request (avoids CORS + preflight-redirect issues).
      proxy: {
        '/emat': {
          target,
          changeOrigin: true,
          secure: false,
          followRedirects: true,
        },
      },
    },
  }
})
