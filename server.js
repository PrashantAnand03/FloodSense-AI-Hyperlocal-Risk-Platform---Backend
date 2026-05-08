import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

import weatherRoutes from './routes/weatherRoutes.js';
import elevationRoutes from './routes/elevationRoutes.js';
import riskRoutes from './routes/riskRoutes.js';
import authRoutes from './routes/authRoutes.js';
import locationsRoutes from './routes/locationsRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import { setupSocketHandlers } from './socket/socketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

import fs from 'fs';
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (body) {
    if (res.statusCode >= 400) {
      const log = `[${new Date().toISOString()}] ${req.method} ${req.url} - Status: ${res.statusCode} - Body: ${body}\n`;
      fs.appendFileSync('debug.log', log);
    }
    originalSend.call(this, body);
  };
  next();
});

// Root check
app.get('/', (req, res) => {
  res.send('🌊 Hyperlocal Flood System API is running!');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/elevation', elevationRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/history', historyRoutes);

// Socket.IO handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🌊 Hyperlocal Flood System — Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🌤️  WeatherAPI.com connected`);
  console.log(`🔐 Supabase Auth connected`);
  console.log(`🗄️  Database: PostgreSQL via Supabase\n`);
});
