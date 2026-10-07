import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true, // Libera o acesso para smartphones na mesma rede Wi-Fi
    port: 5173,
    proxy: {
      '/api/ws': {
        target: 'ws://192.168.15.28:81',
        ws: true,
        changeOrigin: true
      }
    }
  }
});