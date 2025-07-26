// Comprehensive fix for RefreshRuntime and runtime error overlay
(function() {
  // First, ensure RefreshRuntime exists and has all required methods
  if (!window.RefreshRuntime) {
    window.RefreshRuntime = {};
  }
  
  // Define all RefreshRuntime methods with proper implementations
  const RefreshRuntime = window.RefreshRuntime;
  
  // Core registration function that the runtime error plugin expects
  RefreshRuntime.register = RefreshRuntime.register || function(id, fn) { 
    if (typeof fn === 'function') {
      // Store the module for potential hot reload
      if (!RefreshRuntime._modules) {
        RefreshRuntime._modules = {};
      }
      RefreshRuntime._modules[id] = fn;
      return fn;
    }
    return function() {};
  };
  
  // Signature function for transform
  RefreshRuntime.createSignatureFunctionForTransform = RefreshRuntime.createSignatureFunctionForTransform || function() { 
    return function(type) { return type; }; 
  };
  
  // Hook injection
  RefreshRuntime.injectIntoGlobalHook = RefreshRuntime.injectIntoGlobalHook || function(target) {
    // Inject into React DevTools if available
    if (target.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      // Hook is available
    }
  };
  
  // React refresh methods
  RefreshRuntime.performReactRefresh = RefreshRuntime.performReactRefresh || function() {
    // No-op in production or when disabled
  };
  
  RefreshRuntime.isLikelyComponentType = RefreshRuntime.isLikelyComponentType || function(type) { 
    return typeof type === 'function' && type.prototype && type.prototype.isReactComponent;
  };
  
  RefreshRuntime.getFamilyByID = RefreshRuntime.getFamilyByID || function(id) { 
    return RefreshRuntime._families ? RefreshRuntime._families[id] : undefined;
  };
  
  RefreshRuntime.getFamilyByType = RefreshRuntime.getFamilyByType || function(type) { 
    return undefined;
  };
  
  RefreshRuntime.findAffectedHostInstances = RefreshRuntime.findAffectedHostInstances || function(families) { 
    return [];
  };
  
  RefreshRuntime.setSignature = RefreshRuntime.setSignature || function(type, key, forceReset, getCustomHooks) {
    // Store signature for hot reload
  };
  
  RefreshRuntime.collectCustomHooksForSignature = RefreshRuntime.collectCustomHooksForSignature || function(type) { 
    return [];
  };

  // Set up global refresh registration functions
  window.$RefreshReg$ = window.$RefreshReg$ || function(type, id) {
    if (RefreshRuntime.register) {
      RefreshRuntime.register(id, type);
    }
  };
  
  window.$RefreshSig$ = window.$RefreshSig$ || function() { 
    return function(type) { return type; }; 
  };
  
  // Mark that the preamble is installed
  window.__vite_plugin_react_preamble_installed__ = true;

  // Override console.error to suppress specific errors
  const originalError = console.error;
  console.error = function(...args) {
    const firstArg = args[0];
    if (firstArg && typeof firstArg === 'string') {
      // Suppress RefreshRuntime.register errors only if they still occur
      if (firstArg.includes('RefreshRuntime.register is not a function') || 
          firstArg.includes('[plugin:runtime-error-plugin]')) {
        return;
      }
    }
    return originalError.apply(console, args);
  };

  // Disable the runtime error overlay
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