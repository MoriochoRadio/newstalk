import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 백엔드 CORS 가 허용하는 화면 주소 (backend application.yml allowed-origins)
const ALLOWED_ORIGIN = 'http://localhost:5173'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 /api 요청은 백엔드로 넘김 → 코드에 서버 주소를 쓰지 않아도 되고 CORS 문제도 없음
    // 백엔드 주소가 다르면 VITE_API_PROXY_TARGET=http://주소:포트 npm run dev
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        // changeOrigin 은 Host 만 바꾸고 Origin 은 그대로 둠 → 5174·5175 에서 띄우면 쓰기 요청(POST·DELETE)이 403 이었음
        // 개발 서버에서만 Origin 을 백엔드가 허용하는 5173 으로 바꿔 보냄 (배포 빌드에는 영향 없음)
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (proxyReq.getHeader('origin')) proxyReq.setHeader('origin', ALLOWED_ORIGIN)
          })
        },
      },
    },
  },
})
