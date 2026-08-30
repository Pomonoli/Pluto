'use strict';

const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const authDb = require('./src/db');
const { modules } = require('./src/games');
const { configureHttp } = require('./src/server/http');
const { createRealtime } = require('./src/server/realtime');
const { startDatabaseBackups } = require('./src/server/maintenance');

const PORT = Number(process.env.PORT || 3000);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  serveClient:true,
  transports:['websocket','polling']
});

for (const game of modules) game.configure?.({ db:authDb });

const runtime = createRealtime(io);
configureHttp(app, runtime);
runtime.startMaintenance();
startDatabaseBackups();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pluto v1.1.0 draait op poort ${PORT}`);
  console.log(`SQLite: ${authDb.DB_PATH}`);
});
