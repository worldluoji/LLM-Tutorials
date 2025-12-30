import vue from '@vitejs/plugin-vue'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import autoprefixer from 'autoprefixer'
import postcssNested from 'postcss-nested'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
     Components({
      resolvers: [VantResolver()],
    }),
  ],
  css: {
    // 进行 PostCSS 配置
    postcss: {
      plugins: [
        autoprefixer({
          // 指定目标浏览器
          overrideBrowserslist: ['Chrome > 40', 'ff > 31', 'ie 11']
        }),
        postcssNested()
      ]
    }
  }
})
