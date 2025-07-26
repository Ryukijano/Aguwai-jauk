// Fix for Vite runtime error plugin
declare global {
  interface Window {
    __vite_plugin_runtime_error_overlay__?: any;
    RefreshRuntime?: any;
    $RefreshReg$?: any;
    $RefreshSig$?: any;
    __vite_plugin_react_preamble_installed__?: boolean;
  }
}

// Prevent the runtime error overlay from showing
if (typeof window !== 'undefined') {
  // Create a proxy to intercept the overlay
  const handler = {
    get(target: any, prop: string) {
      if (prop === 'show' || prop === 'showErrorOverlay') {
        return () => {}; // No-op
      }
      return target[prop];
    },
    set(target: any, prop: string, value: any) {
      if (prop === 'show' || prop === 'showErrorOverlay') {
        return true; // Pretend we set it
      }
      target[prop] = value;
      return true;
    }
  };
  
  // Replace the error overlay with our proxy
  const overlay = window.__vite_plugin_runtime_error_overlay__ || {};
  window.__vite_plugin_runtime_error_overlay__ = new Proxy(overlay, handler);
  
  // Also ensure RefreshRuntime.register exists
  if (!window.RefreshRuntime) {
    window.RefreshRuntime = {};
  }
  if (!window.RefreshRuntime.register) {
    window.RefreshRuntime.register = function(id: string, fn: any) {
      return fn;
    };
  }
}

export {};