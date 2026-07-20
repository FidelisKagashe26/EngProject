import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 falls inside a Hyper-V/WinNAT reserved port range on Windows
    // (netsh interface ipv4 show excludedportrange protocol=tcp), which makes
    // the bind fail with EACCES. 5273 sits outside every reserved block.
    port: 5273,
    strictPort: true,
  },
})
