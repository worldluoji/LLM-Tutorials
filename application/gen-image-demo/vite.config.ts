import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
    port: 4399,
    proxy: {
      '/api': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
});