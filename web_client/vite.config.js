import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

let proxyOptionsRef = null
let currentEspIp = '192.168.137.162'

export default defineConfig({
  plugins: [
    basicSsl(),
    {
      name: 'dynamic-esp32-ip-proxy',
      configureServer(server) {
        server.middlewares.use('/api/set-ip', (req, res) => {
          try {
            const urlObj = new URL(req.url, 'http://localhost')
            const newIp = urlObj.searchParams.get('ip')
            if (newIp && newIp.trim() !== '') {
              currentEspIp = newIp.trim()
              if (proxyOptionsRef) {
                proxyOptionsRef.target = new URL(`ws://${currentEspIp}:81`)
              }
              console.log(`[Proxy ESP32] IP atualizado pelo Admin para: ${currentEspIp}`)
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, ip: currentEspIp }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false }))
          }
        })
      }
    }
  ],
  server: {
    host: true,
    https: true,
    proxy: {
      '/api/ws': {
        target: 'ws://192.168.137.162:81',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        configure: (proxy, options) => {
          proxyOptionsRef = options
          proxy.on('error', (err) => {
            console.warn(`[Proxy ESP32] Sem resposta em ${currentEspIp}:81 (${err.code || err.message})`)
          })
        }
      }
    }
  }
})