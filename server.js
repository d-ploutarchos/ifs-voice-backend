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

  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'openai-beta': 'realtime=v1',
    },
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
    openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Start a conversation' }],
      },
    }));
  });

  openaiWs.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received from OpenAI:', data);
      if (data.type === 'response.audio.delta' || data.type === 'response.text.delta') {
        ws.send(JSON.stringify({ type: 'ai_response', data: data.delta }));
      } else if (data.type === 'response.done') {
        ws.send(JSON.stringify({ type: 'ai_response_complete', data: data.response.output }));
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
      console.log('Received audio message from client:', message.toString().substring(0, 100));
      let audioData;
      try {
        audioData = JSON.parse(message.toString());
      } catch (parseError) {
        console.error('Failed to parse audio message:', parseError);
        throw new Error('Invalid audio message format');
      }
      if (audioData.type !== 'audio' || !audioData.data) {
        throw new Error('Invalid audio message: missing type or data');
      }
      if (openaiWs.readyState !== WebSocket.OPEN) {
        console.error('OpenAI WebSocket is not open:', openaiWs.readyState);
        throw new Error('OpenAI WebSocket connection closed');
      }
      console.log('Sending audio to OpenAI:', audioData.data.substring(0, 20) + '...');
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioData.data,
      }));
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.commit',
      }));
      console.log('Audio buffer committed to OpenAI');
      openaiWs.send(JSON.stringify({
        type: 'response.create',
      }));
      console.log('Response requested from OpenAI');
    } catch (error) {
      console.error('Error processing audio message:', error);
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
