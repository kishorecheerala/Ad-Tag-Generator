/**
 * Injected into the preview iframe: forwards console output and uncaught
 * errors/rejections to the parent page's console panel via postMessage.
 */
export const CONSOLE_BRIDGE = `
(function () {
  var methods = ['log', 'warn', 'error', 'info', 'debug'];
  function stringify(a) {
    if (a instanceof Error) return a.message;
    if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a); } catch (e) { return String(a); } }
    return String(a);
  }
  methods.forEach(function (m) {
    var original = console[m];
    console[m] = function () {
      var args = Array.prototype.slice.call(arguments).map(stringify);
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'creative-console', level: m, args: args }, '*'); } catch (e) {}
      try { if (window.top && window.top !== window) window.top.postMessage({ source: 'creative-console', level: m, args: args }, '*'); } catch (e) {}
      original.apply(console, arguments);
    };
  });
  window.onerror = function (message, source, lineno) {
    try { window.parent.postMessage({ source: 'creative-console', level: 'error', args: [message + ' (line ' + lineno + ')'] }, '*'); } catch (e) {}
    return false;
  };
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var text = (reason && reason.message) ? reason.message : String(reason);
    try { window.parent.postMessage({ source: 'creative-console', level: 'error', args: ['Unhandled promise rejection: ' + text] }, '*'); } catch (e) {}
  });
})();
`
