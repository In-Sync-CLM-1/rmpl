import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVoiceRecorder } from './useVoiceRecorder';
import { playAudioResponse } from '@/utils/audioPlayer';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface UseVoiceAssistantReturn {
  state: VoiceState;
  currentText: string;
  responseText: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancel: () => void;
}

export function useVoiceAssistant(): UseVoiceAssistantReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [currentText, setCurrentText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const { isRecording, startRecording, stopRecording, error: recorderError } = useVoiceRecorder();

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setCurrentText('');
      setResponseText('');
      setState('listening');
      await startRecording();
    } catch (err) {
      console.error('Failed to start listening:', err);
      setError('Failed to access microphone');
      setState('error');
    }
  }, [startRecording]);

  const stopListening = useCallback(async () => {
    try {
      setState('processing');
      setCurrentText('Processing your question...');
      
      const audioBlob = await stopRecording();
      
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('No audio recorded');
      }

      console.log('Audio blob recorded:', audioBlob.size, 'bytes');

      // Step 1: Convert speech to text
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to use the voice assistant');
      }

      console.log('Sending audio to STT...');
      const sttResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-stt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!sttResponse.ok) {
        const errorData = await sttResponse.json();
        throw new Error(errorData.error || 'Speech recognition failed');
      }

      const sttResult = await sttResponse.json();
      const transcribedText = sttResult.text;
      
      if (!transcribedText || transcribedText.trim() === '') {
        throw new Error('Could not understand. Please try again.');
      }

      console.log('Transcribed text:', transcribedText);
      setCurrentText(transcribedText);

      // Step 2: Process with BI Assistant
      console.log('Sending to BI Assistant...');
      const biResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-bi-assistant`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            query: transcribedText,
            userId: session.user.id 
          }),
        }
      );

      if (!biResponse.ok) {
        const errorData = await biResponse.json();
        throw new Error(errorData.error || 'Failed to process query');
      }

      const biResult = await biResponse.json();
      const responseTextResult = biResult.response;
      
      console.log('BI Response:', responseTextResult);
      setResponseText(responseTextResult);

      // Step 3: Convert response to speech
      setState('speaking');
      console.log('Generating speech...');
      
      const ttsResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: responseTextResult }),
        }
      );

      if (!ttsResponse.ok) {
        // If TTS fails, still show the text response
        console.error('TTS failed, showing text only');
        setState('idle');
        return;
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      console.log('Playing audio response...');
      
      await playAudioResponse(audioBuffer);
      
      setState('idle');
    } catch (err) {
      console.error('Voice assistant error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setState('error');
      
      // Auto-recover to idle after showing error
      setTimeout(() => {
        setState('idle');
      }, 3000);
    }
  }, [stopRecording]);

  const cancel = useCallback(() => {
    stopRecording();
    setState('idle');
    setError(null);
    setCurrentText('');
    setResponseText('');
  }, [stopRecording]);

  return {
    state,
    currentText,
    responseText,
    error: error || recorderError,
    startListening,
    stopListening,
    cancel
  };
}
