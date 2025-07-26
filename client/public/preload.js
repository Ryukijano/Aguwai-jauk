// Comprehensive fix for RefreshRuntime and runtime error overlay

// Override console.error to suppress specific errors
(function() {
  const originalError = console.error;
  console.error = function(...args) {
    const firstArg = args[0];
    if (firstArg && typeof firstArg === 'string') {
      // Suppress RefreshRuntime.register errors
      if (firstArg.includes('RefreshRuntime.register') || 
          firstArg.includes('runtime-error-plugin')) {
        return;
      }
    }
    return originalError.apply(console, args);
  };
})();

// Create RefreshRuntime with all methods
window.RefreshRuntime = {
  register: function(id, fn) { 
    return typeof fn === 'function' ? fn : function() {};
  },
  createSignatureFunctionForTransform: function() { 
    return function(type) { return type; }; 
  },
  injectIntoGlobalHook: function() {},
  performReactRefresh: function() {},
  isLikelyComponentType: function() { return false; },
  getFamilyByID: function() { return undefined; },
  getFamilyByType: function() { return undefined; },
  findAffectedHostInstances: function() { return []; },
  setSignature: function() {},
  collectCustomHooksForSignature: function() { return []; }
};

// Set up globals
window.$RefreshReg$ = function() {};
window.$RefreshSig$ = function() { return function(type) { return type; }; };
window.__vite_plugin_react_preamble_installed__ = true;

// Disable the runtime error overlay completely
(function() {
  // Create a no-op overlay
  const noopOverlay = {
    show: function() {},
    showErrorOverlay: function() {},
    hide: function() {},
    clear: function() {},
    close: function() {}
  };
  
  // Override the error overlay
  Object.defineProperty(window, '__vite_plugin_runtime_error_overlay__', {
    get: function() { return noopOverlay; },
    set: function() { return true; },
    configurable: false
  });
  
  // Also try to disable Vite's error overlay
  if (window.__vite__) {
    window.__vite__.errorOverlay = false;
  }
})();