const WebSocket = require('ws');
const { Buffer } = require('buffer');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  let isResponseActive = false;

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
  });

  openaiWs.on('message', (data) => {
    const response = JSON.parse(data);
    console.log('Received from OpenAI:', response);
    if (response.type === 'response.created') {
      isResponseActive = true;
      console.log('Response active state set to:', isResponseActive);
    } else if (response.type === 'response.done') {
      isResponseActive = false;
      console.log('Response active state set to:', isResponseActive);
    }
    if (response.type === 'response.text.delta') {
      ws.send(JSON.stringify({ type: 'ai_response', data: response.delta }));
    }
  });

  openaiWs.on('error', (err) => console.error('OpenAI WebSocket error:', err));
  openaiWs.on('close', () => console.log('OpenAI WebSocket closed'));

  ws.on('message', (message) => {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
      console.log('Raw audio message received:', message.toString().substring(0, 100));
      console.log('Parsed audio data:', parsedMessage);
    } catch (err) {
      console.error('Error parsing client message:', err);
      return;
    }

    if (parsedMessage.type === 'audio') {
      const audioBase64 = parsedMessage.data;
      let audioBuffer = Buffer.from(audioBase64, 'base64');
      console.log('Received audio buffer length:', audioBuffer.length);

      // Truncate if buffer exceeds 2 seconds (32000 bytes for 16kHz mono)
      const maxExpectedLength = 32000; // 2 seconds
      if (audioBuffer.length > maxExpectedLength) {
        console.warn('Buffer too large, truncating to', maxExpectedLength, 'bytes');
        audioBuffer = audioBuffer.slice(0, maxExpectedLength);
        console.log('Truncated audio buffer length:', audioBuffer.length);
      }
      console.log('First 20 bytes of received audio (hex):', audioBuffer.slice(0, 20).toString('hex'));

      console.log('Sending audio to OpenAI:', audioBase64.substring(0, 20) + '...');
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      }));
      console.log('Audio buffer committed to OpenAI');

      if (!isResponseActive) {
        isResponseActive = true;
        console.log('Requesting response, setting active state to:', isResponseActive);
        openaiWs.send(JSON.stringify({ type: 'response.create' }));
      } else {
        console.log('Response already active, skipping request');
      }
    }
  });

  ws.on('error', (err) => console.error('Client WebSocket error:', err));
  ws.on('close', () => {
    console.log('Client disconnected');
    openaiWs.close();
  });
});
