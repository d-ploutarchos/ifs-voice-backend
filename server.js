const express = require('express');
const WebSocket = require('ws');
const { createServer } = require('http');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

// Mock OpenAI client (replace with real API later)
const openai = {
  connect: () => Promise.resolve(),
  on: (event, callback) => {
    if (event === 'message') {
      setTimeout(() => callback('Mock AI response: What part is here now?'), 1000);
    }
  },
  sendAudio: (data) => Promise.resolve(console.log('Audio received:', data)),
  disconnect: () => console.log('OpenAI disconnected'),
};

wss.on('connection', (ws) => {
  console.log('Client connected');

  openai.connect().then(() => {
    openai.on('message', (message) => {
      ws.send(JSON.stringify({ type: 'ai_response', data: message }));
    });
  });

  ws.on('message', async (message) => {
    const audioData = JSON.parse(message);
    if (audioData.type === 'audio') {
      await openai.sendAudio(audioData.data);
    }
  });

  ws.on('close', () => {
    openai.disconnect();
    console.log('Client disconnected');
  });
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
});
