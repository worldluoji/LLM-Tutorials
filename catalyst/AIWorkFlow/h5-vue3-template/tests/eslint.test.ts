import { ESLint } from 'eslint'
import { describe, it, expect } from 'vitest'

describe('ESLint Configuration', () => {
  const eslint = new ESLint()

  it('should detect unused variables in TypeScript', async () => {
    const results = await eslint.lintText(
      `const unusedVar = 'test'`,
      { filePath: 'test.ts' }
    )
    expect(results[0].messages).toHaveLength(1)
    expect(results[0].messages[0].ruleId).toBe('@typescript-eslint/no-unused-vars')
  })

  it('should warn about console.log', async () => {
    const results = await eslint.lintText(
      `console.log('test')`,
      { filePath: 'test.ts' }
    )
    expect(results[0].messages).toHaveLength(1)
    expect(results[0].messages[0].ruleId).toBe('no-console')
    expect(results[0].messages[0].severity).toBe(1) // 1 = warning
  })

  it('should validate Vue single-file components', async () => {
    const vueCode = `
<template>
  <div>{{ msg }}</div>
</template>

<script setup lang="ts">
defineProps<{ msg: string }>()
</script>
`
    const results = await eslint.lintText(vueCode, { filePath: 'Test.vue' })
    // 应该没有错误 (验证Vue解析器工作正常)
    expect(results[0].errorCount).toBe(0)
  })

  it('should enforce import ordering', async () => {
    const code = `
import path from 'node:path'
import { ref } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
`
    const results = await eslint.lintText(code, { filePath: 'test.ts' })
    expect(results[0].messages.length).toBeGreaterThan(0)
    expect(results[0].messages[0].ruleId).toBe('import/order')
  })
})