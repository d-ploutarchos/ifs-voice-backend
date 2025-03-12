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

  // Connect to OpenAI Realtime API WebSocket with model parameter
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'openai-beta': 'realtime=v1',
    },
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
    // Send initial session start message
    openaiWs.send(JSON.stringify({
      type: 'session.start',
      language: 'en-US',
    }));
  });

  openaiWs.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received from OpenAI:', data);
      if (data.type === 'response.audio.delta' || data.type === 'response.text.delta') {
        ws.send(JSON.stringify({ type: 'ai_response', data: data.delta }));
      }
    } catch (error) {
      console.error('Error parsing OpenAI message:', error);
      ws.send(JSON.stringify({ type: 'error', data: error.message }));
    }
  });

  openaiWs.on('error', (error) => {
    console.error('OpenAI WebSocket error:', error);
    ws.send(JSON.stringify({ type: 'error', data: error.message }));
  });

  openaiWs.on('close', () => {
    console.log('OpenAI WebSocket closed');
  });

  ws.on('message', async (message) => {
    try {
      const audioData = JSON.parse(message);
      if (audioData.type === 'audio') {
        openaiWs.send(JSON.stringify({
          type: 'input_audio',
          audio: audioData.data,  // Base64 audio
        }));
      }
    } catch (error) {
      console.error('Error sending audio to OpenAI:', error);
      ws.send(JSON.stringify({ type: 'error', data: error.message }));
    }
  });

  ws.on('close', () => {
    openaiWs.close();
    console.log('Client disconnected');
  });
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
});
