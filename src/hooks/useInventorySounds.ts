import { useRef, useCallback } from 'react';

type SoundType = 'verified' | 'adjusted' | 'error' | 'scan' | 'success';

export const useInventorySounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((type: SoundType) => {
    try {
      const ctx = getAudioContext();
      
      // Resume context if suspended (required for some browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      let frequency: number;
      let duration: number;
      let waveType: OscillatorType;
      let volume: number;

      switch (type) {
        case 'scan':
          // Quick click to confirm scan
          frequency = 1200;
          duration = 0.05;
          waveType = 'sine';
          volume = 0.2;
          break;

        case 'verified':
          // Short positive beep (stock correct)
          frequency = 880;
          duration = 0.15;
          waveType = 'sine';
          volume = 0.3;
          break;

        case 'adjusted':
          // Medium double beep (stock modified)
          frequency = 660;
          duration = 0.3;
          waveType = 'triangle';
          volume = 0.4;
          break;

        case 'error':
          // Low beep for error
          frequency = 220;
          duration = 0.2;
          waveType = 'sawtooth';
          volume = 0.3;
          break;

        case 'success':
          // Celebratory ascending tone
          frequency = 523; // C5
          duration = 0.5;
          waveType = 'sine';
          volume = 0.35;
          break;

        default:
          frequency = 440;
          duration = 0.1;
          waveType = 'sine';
          volume = 0.2;
      }

      oscillator.frequency.value = frequency;
      oscillator.type = waveType;
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      
      // Fade out to avoid click at the end
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);

      // For adjusted sound, add a second beep
      if (type === 'adjusted') {
        const oscillator2 = ctx.createOscillator();
        const gainNode2 = ctx.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(ctx.destination);
        
        oscillator2.frequency.value = frequency * 1.2;
        oscillator2.type = waveType;
        gainNode2.gain.setValueAtTime(volume, ctx.currentTime + 0.15);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        oscillator2.start(ctx.currentTime + 0.15);
        oscillator2.stop(ctx.currentTime + 0.3);
      }

      // For success sound, add ascending chord (C5 -> E5 -> G5)
      if (type === 'success') {
        const notes = [659, 784]; // E5, G5
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          const startTime = ctx.currentTime + (i + 1) * 0.12;
          gain.gain.setValueAtTime(0.3, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
          osc.start(startTime);
          osc.stop(startTime + 0.25);
        });
      }
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }, [getAudioContext]);

  const playScan = useCallback(() => playSound('scan'), [playSound]);
  const playVerified = useCallback(() => playSound('verified'), [playSound]);
  const playAdjusted = useCallback(() => playSound('adjusted'), [playSound]);
  const playError = useCallback(() => playSound('error'), [playSound]);
  const playSuccess = useCallback(() => playSound('success'), [playSound]);

  return { playScan, playVerified, playAdjusted, playError, playSuccess };
};
