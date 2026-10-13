import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['node_modules', 'coverage', 'CHANGELOG.md'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: { process: 'readonly' } },
  },
)
