const express = require('express');
const WebSocket = require('ws');
const { createServer } = require('http');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Connect to OpenAI Realtime API WebSocket
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime-v1',  // Hypothetical beta header
    },
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
  });

  openaiWs.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'response.audio.delta') {
        ws.send(JSON.stringify({ type: 'ai_response', data: data.delta }));
      } else if (data.type === 'response.text.delta') {
        ws.send(JSON.stringify({ type: 'ai_response', data: data.delta }));
      }
    } catch (error) {
      console.error('Error parsing OpenAI message:', error);
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
