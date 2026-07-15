import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Fast Rental agent UI — Union Rental owns :5174; fail instead of auto-bumping.
    port: 5173,
    strictPort: true,
  },
});
