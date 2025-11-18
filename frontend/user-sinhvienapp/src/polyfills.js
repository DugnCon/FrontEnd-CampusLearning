/*-----------------------------------------------------------------
* File: polyfills.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student portal application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/

/* eslint-env browser */
/* global globalThis */

/**
 * Polyfills for browser-related functionality
 */

// Immediately define browser in global scope
if (typeof globalThis === 'undefined') {
  window.globalThis = window;
}

if (typeof browser === 'undefined') {
  globalThis.browser = window.browser || window.chrome || {};
}

// Polyfill for browser if it doesn't exist
if (typeof window !== 'undefined') {
  window.browser = window.browser || globalThis.browser || window.chrome || {};
  
  if (!window.browser.runtime) {
    window.browser.runtime = {
      sendMessage: () => Promise.resolve({}),
      onMessage: {
        addListener: () => {},
        removeListener: () => {}
      },
      connect: () => ({
        onMessage: {
          addListener: () => {}
        },
        postMessage: () => {},
        disconnect: () => {}
      })
    };
  }
  
  if (typeof window.start === 'undefined') {
    window.start = function() {
      console.log('Polyfill for window.start called');
      return {
        browser: window.browser,
        init: () => {},
        dispose: () => {},
        connect: () => {}
      };
    };
  }
  
  window.addEventListener('error', (event) => {
    if (event.message && 
        (event.message.includes('browser is not defined') || 
         event.message.includes('cannot read properties of null (reading') ||
         event.message.includes('start is not defined'))) {
      console.warn('Suppressing browser-related error:', event.message);
      event.preventDefault();
      return true;
    }
    return false;
  }, true);
}

export default {};
