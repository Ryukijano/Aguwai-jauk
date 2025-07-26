// Local vite config to disable fast refresh
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.FAST_REFRESH': 'false',
    'import.meta.env.VITE_DISABLE_REACT_REFRESH': 'true'
  },
  esbuild: {
    jsxDev: false
  }
});