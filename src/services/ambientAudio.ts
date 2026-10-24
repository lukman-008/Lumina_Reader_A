import type { SoundscapeType } from '../types';

/**
 * Procedural Web Audio Ambient Soundscape Generator
 * Zero external MP3 dependencies — works 100% offline across Web, Desktop, and Mobile.
 */
class AmbientAudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private currentType: SoundscapeType = 'none';
  private volume = 0.4;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setSoundscape(type: SoundscapeType, volume?: number): void {
    if (typeof volume === 'number') {
      this.volume = Math.max(0, Math.min(1, volume));
    }
    if (type === this.currentType && type !== 'none') {
      this.setVolume(this.volume);
      return;
    }

    this.stop();
    this.currentType = type;
    if (type === 'none') return;

    try {
      const ctx = this.ensureContext();
      if (!this.masterGain) return;
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);

      // Generate 4-second looping pink/brown noise buffer
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 2.8;
      }

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      if (type === 'rain') {
        filter.type = 'bandpass';
        filter.frequency.value = 950;
        filter.Q.value = 0.7;
      } else if (type === 'fireplace') {
        filter.type = 'lowpass';
        filter.frequency.value = 260;
      } else if (type === 'library') {
        filter.type = 'lowpass';
        filter.frequency.value = 180;
      } else if (type === 'vinyl') {
        filter.type = 'highpass';
        filter.frequency.value = 1200;
      } else {
        // brown_noise
        filter.type = 'lowpass';
        filter.frequency.value = 340;
      }

      source.connect(filter);
      filter.connect(this.masterGain);
      source.start();
      this.activeNodes.push(source, filter);
    } catch (err) {
      console.warn('Web Audio API unavailable:', err);
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioBufferSourceNode).stop === 'function') {
          (node as AudioBufferSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
    this.activeNodes = [];
    this.currentType = 'none';
  }
}

export const ambientAudio = new AmbientAudioService();
