import js from '@eslint/js'
import globals from 'globals'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import importPlugin from 'eslint-plugin-import'

// 基础配置：适用于所有文件
const baseConfig = {
  // 基础规则
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
  },
}

// JavaScript配置
const jsConfig = {
  files: ['**/*.{js,mjs,cjs}'],
  ...js.configs.recommended,
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  rules: {
    ...baseConfig.rules,
  },
}

// TypeScript配置
const tsConfig = {
  files: ['**/*.{ts,tsx}'],
  plugins: {
    '@typescript-eslint': tsPlugin,
    'import': importPlugin,
  },
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.node,
    },
    parserOptions: {
      project: ['./tsconfig.app.json'], // 指定TypeScript配置文件
    }
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue']
      }
    },
  },
  rules: {
    ...js.configs.recommended.rules,
    ...baseConfig.rules,
    // TypeScript规则 (适中严格度)
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    // 导入/导出规则
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'object',
        'type'
      ],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true }
    }],
    'import/no-unresolved': 'off', // 关闭此规则，因为它会与typescript resolver冲突
  },
}

// Vue配置
const vueConfig = {
  files: ['**/*.vue'],
  plugins: {
    'vue': vuePlugin,
    '@typescript-eslint': tsPlugin,
    'import': importPlugin,
  },
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tsParser,
      project: ['./tsconfig.app.json'], // 指定TypeScript配置文件
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    globals: {
      ...globals.browser,
    },
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue']
      }
    },
  },
  rules: {
    ...baseConfig.rules,
    // Vue规则调整 (适中严格度)
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',
    'vue/require-default-prop': 'off',
    // TypeScript规则
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    // 导入/导出规则
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'object',
        'type'
      ],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true }
    }],
    'import/no-unresolved': 'off', // 关闭此规则，因为它会与typescript resolver冲突
  },
}

// 忽略配置
const ignoreConfig = {
  ignores: [
    'node_modules/',
    'dist/',
    '*.min.js',
    'coverage/',
    '*.log',
    '.DS_Store',
    '.env',
    '.env.local',
    '.env.*.local',
  ],
}

export default [
  ignoreConfig,
  jsConfig,
  tsConfig,
  vueConfig,
]