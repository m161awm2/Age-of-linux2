import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로를 사용해 사용자/저장소명과 무관하게 GitHub Pages 하위 경로에서 동작합니다.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
