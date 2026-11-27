'use strict';

const { WebSocketServer } = require('ws');
const { normalizeSite } = require('./blocklist');
const { cleanStrip } = require('./geometry');

const PORT = 47821;
// The ID that the "key" line in extension/manifest.json gives our extension.
const EXTENSION_ORIGIN = 'chrome-extension://jemlpfigfnlpgkobdggmhflhbghnbadf';

// Talks to the Chrome extension. Listens on this computer only, and accepts
// only the Origin of our own extension: web pages and other extensions are refused.
function startServer({ port = PORT, onActive, onConnectionChange, onError }) {
  const clients = new Set();
  let current = null; // the browser that reported the tab in front

  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port,
    maxPayload: 4096,
    verifyClient: ({ origin }) => origin === EXTENSION_ORIGIN,
  });

  wss.on('error', (error) => onError && onError(error));

  wss.on('connection', (socket) => {
    clients.add(socket);
    onConnectionChange(true);

    function read(data) {
      const message = JSON.parse(data.toString());
      if (!message || message.type !== 'active') return;
      const host = normalizeSite(message.host);
      if (host && Number.isInteger(message.tabId)) {
        current = socket;
        onActive({
          tabId: message.tabId, host, strip: cleanStrip(message.strip), restored: message.restored === true,
        });
      } else if (current === socket || current === null) {
        onActive(null);
      }
    }

    // A broken or hostile message is dropped; it must never crash the app.
    socket.on('message', (data) => {
      try {
        read(data);
      } catch (error) {
        console.warn('Ignored a bad message:', error.message);
      }
    });

    socket.on('error', () => {});
    socket.on('close', () => {
      clients.delete(socket);
      if (current === socket) {
        current = null;
        onActive(null);
      }
      onConnectionChange(clients.size > 0);
    });
  });

  return {
    closeTab(tabId, host) {
      if (current && current.readyState === 1) current.send(JSON.stringify({ type: 'close', tabId, host }));
    },
    stop() {
      for (const socket of clients) socket.terminate();
      wss.close();
    },
  };
}

module.exports = { startServer, PORT, EXTENSION_ORIGIN };
