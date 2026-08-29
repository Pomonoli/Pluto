'use strict';

const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const authDb = require('./src/db');
const minigolf = require('./src/minigolf');
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

// Persistence-owned custom maps are injected into the Minigolf engine.
minigolf.setCustomMapProvider(() => authDb.listMinigolfMaps().map((row) => ({
  id:`custom-${row.id}`,
  ...row.map,
  ownerName:row.ownerName
})));

const runtime = createRealtime(io);
configureHttp(app, runtime);
runtime.startMaintenance();
startDatabaseBackups();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pluto v0.11 draait op poort ${PORT}`);
  console.log(`SQLite: ${authDb.DB_PATH}`);
});
