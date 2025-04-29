import fs from 'fs';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import { handleLogin, handleRegistration } from './auth.js';
import { handleMessage, handleJoin, handleDisconnect, handleFile } from './chat.js';
import { initLogging, logSystemEvent } from './logger.js';
import { initKeyStorage, generateKeyPair } from './advanced-encryption.js';
import { resetExceedCountPeriodically } from './ratelimiting.js';
import { startKeepAlive } from './keep_alive.js'; // <<< NEW

// Paths & Directories Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express Server
const app = express();
const STATIC_DIR = path.join(__dirname, '../client');
app.use(express.static(STATIC_DIR));
app.use(express.json());

console.log("__filename ", __filename);
console.log("__dirname ", __dirname);
console.log("STATIC_DIR ", STATIC_DIR);

// Serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'login.html'));
});

// Add endpoint for key generation
app.post('/generate-keys', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const keys = await generateKeyPair(username);
    res.json(keys);
  } catch (error) {
    console.error('Error generating keys:', error);
    res.status(500).json({ error: 'Failed to generate keys' });
  }
});

// Initialize key storage and logging system
async function init() {
  await initKeyStorage();
  await initLogging();
  await logSystemEvent('Server started');
}

// Initialize server
const port = process.env.PORT || 8001;
const server = app.listen(port, () => {
  console.log(`[${new Date().toISOString()}] Server running on https://honeypot-render-test.onrender.com`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (client, req) => {
  console.log("New client connected.");

  // Get the client's IP address
  const clientIP = req.socket.remoteAddress;
  client.ip = clientIP;
  client.authenticated = false;

  client.on('message', async (data) => {
    try {
      console.log("Server received raw data:", data);
      const parsedData = JSON.parse(data);
      console.log("Received:", parsedData);

      switch (parsedData.type) {
        case "login":
          const success = await handleLogin(client, parsedData.username, parsedData.password, clientIP);
          client.authenticated = success;
          break;

        case "registration":
          const registration_success = await handleRegistration(client, parsedData.username, parsedData.password, clientIP);
          client.authenticated = registration_success;
          break;

        case "join":
          client.authenticated = true;
          handleJoin(client, parsedData.username, wss);
          break;

        case "message":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send messages." }));
            return;
          }
          handleMessage(client, parsedData.username, parsedData.message, parsedData.reciever, wss);
          break;

        case "file":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to send files." }));
            return;
          }
          handleFile(client, parsedData.username, parsedData.filename, parsedData.filetype, parsedData.data, parsedData.reciever, wss);
          break;

        case "publicKey":
          if (!client.authenticated) {
            client.send(JSON.stringify({ type: "error", error: "You must be logged in to exchange keys." }));
            return;
          }
          handlePublicKey(client, parsedData.username, parsedData.publicKey);
          break;

        default:
          client.send(JSON.stringify({ type: "error", error: "Unknown message type." }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  client.on('close', () => {
    console.log("Client disconnected.");
    handleDisconnect(client, wss);
  });
});

// Handle client public key submission
function handlePublicKey(client, username, publicKey) {
  try {
    setUserPublicKey(username, publicKey);
    client.send(JSON.stringify({ type: "keyExchange", status: "success" }));
    logSystemEvent(`Public key received from user ${username}`);
  } catch (error) {
    console.error("Error storing public key:", error);
    client.send(JSON.stringify({ 
      type: "error", 
      error: "Failed to store public key."
    }));
  }
}

// Periodically reset rate limiting
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.authenticated && client.rateLimitData) {
      resetExceedCountPeriodically(client);
    }
  });
}, 60000);

// Start keep-alive pings
init()
  .then(() => {
    startKeepAlive();
  })
  .catch(error => {
    console.error('Failed to initialize server:', error);
  });
