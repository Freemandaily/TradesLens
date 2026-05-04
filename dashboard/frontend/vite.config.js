import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Load env vars from the current directory
    const env = loadEnv(mode, process.cwd(), '');
    const target = env.VITE_API_TARGET || 'https://tradeslens.onrender.com';

    return {
        plugins: [react()],
        server: {
            host: true,
            port: 5173,
            proxy: {
                '/api': {
                    target: target,
                    changeOrigin: true,
                    ws: true,
                    secure: false, // Crucial for avoiding SSL/TLS proxy errors like EPIPE
                }
            }
        }
    }
})
