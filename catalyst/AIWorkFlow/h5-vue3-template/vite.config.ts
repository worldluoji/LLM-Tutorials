import vue from '@vitejs/plugin-vue'
import { VantResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
     Components({
      resolvers: [VantResolver()],
    }),
  ],
})
