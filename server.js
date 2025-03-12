const express = require('express');
const WebSocket = require('ws');
const { createServer } = require('http');
const OpenAI = require('openai');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  let connection;
  try {
    connection = openai.beta.realtime.connect({
      model: 'gpt-4o-realtime-preview-2024-12-17',
    });

    connection.on('response.text.delta', (event) => {
      ws.send(JSON.stringify({ type: 'ai_response', data: event.delta }));
    });

    connection.on('error', (error) => {
      console.error('OpenAI Realtime API error:', error);
      ws.send(JSON.stringify({ type: 'error', data: error.message }));
    });

    ws.on('message', async (message) => {
      const audioData = JSON.parse(message);
      if (audioData.type === 'audio') {
        await connection.send({
          type: 'input_audio',
          audio: audioData.data, // Base64 audio
        });
      }
    });

    ws.on('close', () => {
      connection.close();
      console.log('Client disconnected');
    });
  } catch (error) {
    console.error('Failed to connect to OpenAI Realtime API:', error);
    ws.send(JSON.stringify({ type: 'error', data: error.message }));
    ws.close();
  }
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
});
