import {renderingPlugin} from './rendering-settings.mjs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { aiPlugin } from './ai-server.mjs';
export default defineConfig(({mode})=>({plugins:[react(),renderingPlugin(),aiPlugin(loadEnv(mode,process.cwd(),''))],base:'./',server:{allowedHosts:true,watch:{ignored:['**/config/mg400-*.json']},fs:{deny:['**/.runtime/**','.env','.env.*','.local-ai.json','.local-operations.json','**/*.sqlite*','**/*.db*','**/.git/**']}},build:{rollupOptions:{input:{main:'index.html',styles:'styles-lab.html',coding:'coding-practice.html'}}}}));
