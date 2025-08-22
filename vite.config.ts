import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      '@capacitor/core',
      '@capacitor/splash-screen',
      '@capacitor/haptics',
      '@capacitor/push-notifications'
    ]
  },
  define: {
    'process.env': {}
  },
  base: './',
  build: {
    rollupOptions: {
      external: [/^@capacitor\/.*$/],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        }
      }
    }
  },
  resolve: {
    alias: {
      // Provide empty modules for Capacitor plugins in web environment
      '@capacitor/core': resolve(__dirname, 'src/lib/capacitor-stubs/core.ts'),
      '@capacitor/splash-screen': resolve(__dirname, 'src/lib/capacitor-stubs/splash-screen.ts'),
      '@capacitor/haptics': resolve(__dirname, 'src/lib/capacitor-stubs/haptics.ts'),
      '@capacitor/push-notifications': resolve(__dirname, 'src/lib/capacitor-stubs/push-notifications.ts'),
    }
  }
});