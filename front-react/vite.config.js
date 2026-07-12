import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vite.dev/config/
export default defineConfig(function (_a) {
    var mode = _a.mode;
    return ({
        plugins: [react()],
        esbuild: mode === 'production'
            ? {
                drop: ['console', 'debugger'],
            }
            : undefined,
        server: {
            port: 5173,
            host: true,
        },
    });
});
