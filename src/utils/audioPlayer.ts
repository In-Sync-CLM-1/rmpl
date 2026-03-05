// Audio player utility for Voice BI Assistant

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export async function playAudioBlob(audioBlob: Blob): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const ctx = getAudioContext();
      
      // Resume context if suspended (required after user interaction)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        resolve();
      };

      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      reject(error);
    }
  });
}

export async function playAudioFromUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    
    audio.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    
    audio.play().catch(reject);
  });
}

export async function playAudioResponse(audioBuffer: ArrayBuffer): Promise<void> {
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  return playAudioFromUrl(url);
}
