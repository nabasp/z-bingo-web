/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // The provider tests render React and read `document`, so they need a DOM.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/testSetup.ts'],
    /*
     * `config/env` throws at import when these are missing, by design — a
     * missing base URL should fail the build, not surface later as an
     * undefined fetch. Tests still have to import modules that reach it, so
     * they get placeholder values; nothing under test makes a real request.
     */
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_APP_ID: 'test-app-id',
    },
  },
})
