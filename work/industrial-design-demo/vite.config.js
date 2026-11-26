import { networkInterfaces } from 'node:os';
import {renderingPlugin} from './rendering-settings.mjs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { aiPlugin } from './ai-server.mjs';
function platformAddressPlugin() {
  const configure = (server) => {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' || req.url !== '/api/platform/addresses') return next();
      const listener = server.httpServer?.address();
      const bound = listener && typeof listener === 'object' ? listener.address : '';
      const protocol = req.socket.encrypted ? 'https' : 'http';
      const wildcard = bound === '0.0.0.0' || bound === '::';
      const interfaces = Object.entries(networkInterfaces()).flatMap(([name, entries]) => entries
        .filter(({ address, family, internal }) => family === 'IPv4' && !internal && (wildcard || address === bound))
        .map(({ address }) => ({ name, origin: `${protocol}://${address}:${listener.port}` })));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(interfaces));
    });
  };
  return { name: 'platform-addresses', configureServer: configure, configurePreviewServer: configure };
}
export default defineConfig(({mode})=>({plugins:[react(),platformAddressPlugin(),renderingPlugin(),aiPlugin(loadEnv(mode,process.cwd(),''))],base:'./',server:{host:'0.0.0.0',allowedHosts:true,watch:{ignored:['**/config/mg400-*.json']},fs:{deny:['**/.runtime/**','.env','.env.*','.local-ai.json','.local-operations.json','**/*.sqlite*','**/*.db*','**/.git/**']}},build:{rollupOptions:{input:{main:'index.html',styles:'styles-lab.html',coding:'coding-practice.html'}}}}));
