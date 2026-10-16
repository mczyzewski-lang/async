/**
 * Polish voice guidance.
 *
 * `VoiceProvider` is the adapter contract. The default implementation uses the browser's
 * Web Speech API (no API key, works offline on most devices with a Polish voice installed).
 * A premium provider (e.g. a cloud TTS returning audio) can be registered with
 * `registerVoiceProvider` without touching the UI or the session player.
 */

export interface VoiceSettings {
  enabled: boolean;
  gender: 'female' | 'male' | 'any';
  rate: number;
  volume: number;
  voiceURI?: string;
}

export interface VoiceProvider {
  id: string;
  label: string;
  available(): boolean;
  speak(text: string, settings: VoiceSettings): Promise<void>;
  cancel(): void;
  /** Must be called from a user gesture on mobile (Safari) before the first `speak`. */
  unlock(): void;
  listVoices(): Array<{ uri: string; name: string; lang: string }>;
}

const FEMALE_HINTS = ['zosia', 'ewa', 'agnieszka', 'paulina', 'female', 'kobieta', 'maja', 'zofia', 'marta'];
const MALE_HINTS = ['krzysztof', 'jacek', 'jan', 'male', 'mężczyzna', 'adam', 'piotr'];

function plVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('pl'));
}

function pickVoice(settings: VoiceSettings): SpeechSynthesisVoice | undefined {
  const voices = plVoices();
  if (settings.voiceURI) {
    const v = voices.find((x) => x.voiceURI === settings.voiceURI);
    if (v) return v;
  }
  if (settings.gender !== 'any') {
    const hints = settings.gender === 'female' ? FEMALE_HINTS : MALE_HINTS;
    const v = voices.find((x) => hints.some((h) => x.name.toLowerCase().includes(h)));
    if (v) return v;
  }
  return voices.find((v) => v.localService) ?? voices[0];
}

export class WebSpeechProvider implements VoiceProvider {
  id = 'web-speech';
  label = 'Głos systemowy (Web Speech)';
  private unlocked = false;

  available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  listVoices() {
    return plVoices().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }));
  }

  unlock() {
    if (!this.available() || this.unlocked) return;
    try {
      // iOS requires the first utterance to originate from a user gesture.
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'pl-PL';
      speechSynthesis.speak(u);
      this.unlocked = true;
    } catch {
      /* ignore */
    }
  }

  speak(text: string, settings: VoiceSettings) {
    return new Promise<void>((resolve) => {
      if (!this.available() || !settings.enabled || !text.trim()) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pl-PL';
      const v = pickVoice(settings);
      if (v) u.voice = v;
      u.rate = settings.rate;
      u.volume = settings.volume;
      u.pitch = settings.gender === 'male' && !v ? 0.85 : 1;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      u.onend = finish;
      u.onerror = finish;
      // Safety timeout: some engines never fire `end`.
      setTimeout(finish, Math.max(3000, text.length * 120));
      // Chrome stops speaking long queues; speaking one utterance at a time avoids that.
      speechSynthesis.speak(u);
    });
  }

  cancel() {
    if (this.available()) speechSynthesis.cancel();
  }
}

/** Silent provider, used in tests and when speech is unsupported. */
export class SilentProvider implements VoiceProvider {
  id = 'silent';
  label = 'Bez głosu';
  available() {
    return true;
  }
  listVoices() {
    return [];
  }
  unlock() {}
  async speak() {}
  cancel() {}
}

const providers = new Map<string, VoiceProvider>();
providers.set('web-speech', new WebSpeechProvider());
providers.set('silent', new SilentProvider());

export function registerVoiceProvider(p: VoiceProvider) {
  providers.set(p.id, p);
}

export function getVoiceProvider(id = 'web-speech'): VoiceProvider {
  const p = providers.get(id);
  if (p && p.available()) return p;
  return providers.get('silent')!;
}

/**
 * Queue that speaks one line at a time and can be cancelled instantly (pause / skip).
 * Every line carries a generation id so stale lines from a previous step are dropped.
 */
export class VoiceQueue {
  private queue: string[] = [];
  private speaking = false;
  private generation = 0;
  /** Lines spoken (useful for tests and the on-screen caption). */
  readonly log: string[] = [];
  onSpeak?: (text: string) => void;

  constructor(private provider: VoiceProvider, private settings: () => VoiceSettings) {}

  say(text: string) {
    this.queue.push(text);
    this.pump();
  }

  private async pump() {
    if (this.speaking) return;
    const gen = this.generation;
    const next = this.queue.shift();
    if (!next) return;
    this.speaking = true;
    this.log.push(next);
    this.onSpeak?.(next);
    await this.provider.speak(next, this.settings());
    this.speaking = false;
    if (gen === this.generation) this.pump();
  }

  clear() {
    this.generation++;
    this.queue = [];
    this.speaking = false;
    this.provider.cancel();
  }
}
