import vue from '@vitejs/plugin-vue'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, PluginOption } from 'vite'
import autoprefixer from 'autoprefixer'
import postcssNested from 'postcss-nested'
import legacy from '@vitejs/plugin-legacy' // vite5 只能兼容到legacy 4.x
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
    legacy({
      targets: ['last 2 versions', '> 0.2%', 'not dead', 'not IE 11'],
    }),
  ] as PluginOption[],
  resolve: {
    alias: {
      '@': resolve(dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
  css: {
    postcss: {
      plugins: [
        autoprefixer({
          overrideBrowserslist: ['last 2 versions', '> 0.2%', 'not dead', 'not IE 11']
        }),
        postcssNested()
      ]
    }
  }
})