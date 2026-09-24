import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  // Empty prefix so VITE_* and any other vars are both readable here.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_BASE_URL || 'https://alphaapi.quicko.rw'

  /**
   * Opt-in dev proxy.
   *
   * alphaapi.quicko.rw does send access-control-allow-origin, but its
   * preflight still allows only GET/HEAD/POST - so cross-origin PATCH, PUT
   * and DELETE are blocked. Proxying makes requests same-origin in
   * development, which sidesteps CORS entirely.
   *
   * Set VITE_USE_DEV_PROXY=false to talk to the API directly.
   */
  const useProxy = env.VITE_USE_DEV_PROXY !== 'false'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Required for the `@/...` imports used throughout src. Without it
        // the dev server 500s on "Failed to resolve import @/App".
        '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), './src'),
      },
    },
    preview: {
      port: 4179,
      allowedHosts: ['dashboard.quicko.rw', 'localhost', '127.0.0.1'],
    },
    server: {
      port: 5173,
      /**
       * Bind every interface, not just the default.
       *
       * Without this Vite listened on [::1] alone, so http://127.0.0.1:PORT
       * was refused while http://localhost:PORT worked. Windows browsers do
       * not agree on which one `localhost` resolves to, and a refused request
       * surfaces as the axios NETWORK_ERROR toast ("Cannot reach the server"),
       * which looks like the API is down when it is not.
       */
      host: true,
      proxy: useProxy
        ? {
            '/api': {
              target,
              changeOrigin: true,
              secure: true,
              // The API sets cookies for its own host; rewrite the domain so
              // the browser accepts them on localhost.
              cookieDomainRewrite: '',
            },
            '/health': { target, changeOrigin: true, secure: true },
            '/ready': { target, changeOrigin: true, secure: true },
            // Company logos are served from the API host as /uploads/...
            '/uploads': { target, changeOrigin: true, secure: true },
          }
        : undefined,
    },
  }
})
