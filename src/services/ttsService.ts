type SentenceChangeCallback = (sentence: string) => void;

class OfflineTTSService {
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private isPlaying = false;
  private isPaused = false;
  private rate = 1.0;
  private sentences: string[] = [];
  private currentIdx = 0;
  private listeners = new Set<SentenceChangeCallback>();

  public onSentenceChange(cb: SentenceChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(sentence: string) {
    this.listeners.forEach((cb) => cb(sentence));
  }

  public speakText(text: string, rate = 1.0): void {
    if (!this.synth) return;
    this.stop();
    this.rate = rate;
    this.sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
    this.currentIdx = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.speakCurrent();
  }

  private speakCurrent(): void {
    if (!this.synth || !this.isPlaying || this.currentIdx >= this.sentences.length) {
      this.stop();
      return;
    }
    const sentence = this.sentences[this.currentIdx];
    this.notify(sentence);

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = this.rate;
    utterance.onend = () => {
      if (this.isPlaying && !this.isPaused) {
        this.currentIdx += 1;
        this.speakCurrent();
      }
    };
    utterance.onerror = () => {
      this.stop();
    };
    this.synth.speak(utterance);
  }

  public pause(): void {
    if (!this.synth) return;
    this.synth.pause();
    this.isPaused = true;
  }

  public resume(): void {
    if (!this.synth) return;
    this.synth.resume();
    this.isPaused = false;
  }

  public setRate(rate: number): void {
    this.rate = rate;
    if (this.isPlaying) {
      this.synth?.cancel();
      this.speakCurrent();
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.sentences = [];
    this.currentIdx = 0;
    this.notify('');
    try {
      this.synth?.cancel();
    } catch {
      // ignore
    }
  }

  public getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      rate: this.rate,
    };
  }
}

export const ttsService = new OfflineTTSService();
