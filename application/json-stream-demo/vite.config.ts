import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
    port: 4399,
    proxy: {
      '/compatible-mode': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
      },
    },
  },
  plugins: [vue()],
})
