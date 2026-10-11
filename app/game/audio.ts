import type { TidalAudioScene } from './tidal/audio-scene.ts';
export type SoundCue =
  | 'migration'
  | 'gulp'
  | 'grow'
  | 'food'
  | 'dash'
  | 'hit'
  | 'skill'
  | 'birth'
  | 'win'
  | 'death';
export type AudioHabitat = 'pond' | 'ocean' | 'shore' | 'land' | 'colony';
export const DEFAULT_AUDIO_LEVELS = { music: 0.3, ambience: 0, effects: 0.14 };
const AUDIO_LEVELS_KEY = 'spore-audio-levels-v1';
export function readAudioLevels(storage?: {
  getItem: (key: string) => string | null;
}) {
  try {
    const source =
      storage ??
      (typeof localStorage === 'undefined' ? undefined : localStorage);
    const stored = JSON.parse(source?.getItem(AUDIO_LEVELS_KEY) ?? 'null');
    const result = { ...DEFAULT_AUDIO_LEVELS };
    for (const key of ['music', 'effects'] as const)
      if (typeof stored?.[key] === 'number' && Number.isFinite(stored[key]))
        result[key] = Math.max(0, Math.min(1, stored[key]));
    return result;
  } catch {
    return { ...DEFAULT_AUDIO_LEVELS };
  }
}
/** One music element and one effects context per game, started only from a user gesture. */
export class GameAudio {
  private music: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private playing = false;
  private muted = false;
  private lastCue = new Map<SoundCue, number>();
  private nodes = new Set<OscillatorNode>();
  private disposed = false;
  private failed = false;
  private scene: TidalAudioScene | null = null;
  private habitat: AudioHabitat = 'pond';
  constructor(habitat: AudioHabitat = 'pond') {
    this.habitat = habitat;
  }
  private volumes = readAudioLevels();
  setHabitat(habitat: AudioHabitat) {
    if (habitat === this.habitat || this.disposed) return;
    this.habitat = habitat;
    if (!this.music) return;
    this.music.pause();
    this.music.src = `/audio/life/${habitat}.mp3`;
    this.music.load();
    if (this.playing && !this.muted) void this.unlock();
  }
  private updateMusicVolume() {
    if (this.music)
      this.music.volume =
        this.volumes.music * (this.scene === 'danger' ? 0.72 : 1);
  }
  setVolumes(volume: { music: number; ambience: number; effects: number }) {
    for (const key of ['music', 'ambience', 'effects'] as const)
      this.volumes[key] = Number.isFinite(volume[key])
        ? Math.max(0, Math.min(1, volume[key]))
        : 0;
    this.updateMusicVolume();
    if (this.bus) this.bus.gain.value = this.volumes.effects;
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.setItem(AUDIO_LEVELS_KEY, JSON.stringify(this.volumes));
    } catch {
      /* Audio works even when preference storage is unavailable. */
    }
  }
  setScene(scene: TidalAudioScene | null) {
    if (scene === this.scene) return;
    this.scene = scene;
    // The score owns harmony. Scene changes duck it; event cues supply the accents.
    this.updateMusicVolume();
  }
  get available() {
    return !this.failed;
  }
  async unlock() {
    if (this.disposed) return false;
    try {
      if (!this.music) {
        this.music = new Audio(`/audio/life/${this.habitat}.mp3`);
        this.music.loop = true;
        this.music.muted = this.muted;
        this.updateMusicVolume();
        this.music.preload = 'auto';
        this.music.addEventListener('error', () => {
          if (!this.disposed) this.failed = true;
        });
      }
      if (!this.context) {
        this.context = new AudioContext();
        this.bus = this.context.createGain();
        this.bus.gain.value = this.volumes.effects;
        this.bus.connect(this.context.destination);
      }
      if (this.muted) return true;
      await Promise.all([
        this.context.state === 'suspended'
          ? this.context.resume()
          : Promise.resolve(),
        this.playing ? this.music.play() : Promise.resolve(),
      ]);
      this.failed = false;
      return true;
    } catch (error) {
      if (this.disposed) return false;
      // A pause or mute can intentionally interrupt a still-pending play request.
      if (!this.playing || this.muted) return true;
      console.warn('Game audio could not start', error);
      this.failed = true;
      return false;
    }
  }
  setPlaying(on: boolean) {
    if (on === this.playing) return;
    this.playing = on;
    if (!on) {
      this.music?.pause();
      this.stopEffects();
    } else if (!this.muted && this.music) {
      void this.music.play().catch(() => {
        if (this.playing && !this.muted && !this.disposed) this.failed = true;
      });
    }
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.music) this.music.muted = muted;
    if (muted) {
      this.music?.pause();
      this.stopEffects();
    } else if (this.playing) void this.unlock();
  }
  cue(type: SoundCue) {
    const c = this.context;
    if (!c || !this.bus || this.muted || c.state !== 'running' || this.disposed)
      return;
    const now = c.currentTime;
    if (now - (this.lastCue.get(type) ?? -100) < (type === 'food' ? 0.1 : 0.2))
      return;
    this.lastCue.set(type, now);
    const notes: Record<SoundCue, number[]> = {
      migration: [147, 220, 294, 330, 370, 440],
      gulp: [220, 147, 294],
      grow: [294, 370, 440, 587],
      food: [440, 587],
      dash: [170, 95],
      hit: [140, 92],
      skill: [294, 440, 587],
      birth: [220, 294, 370, 440, 587],
      win: [220, 294, 370, 440, 587, 740],
      death: [220, 165, 110],
    };
    const long =
      type === 'migration' ||
      type === 'birth' ||
      type === 'win' ||
      type === 'grow';
    notes[type].forEach((f, i) => {
      const at = now + i * (long ? 0.14 : 0.045),
        duration = long ? 1.5 : type === 'dash' ? 0.28 : 0.38;
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = type === 'hit' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, at);
      if (type === 'dash')
        osc.frequency.exponentialRampToValueAtTime(f * 0.5, at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(
        type === 'food' ? 0.11 : 0.2,
        at + 0.035,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      gain.connect(this.bus!);
      this.nodes.add(osc);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        this.nodes.delete(osc);
      };
      osc.start(at);
      osc.stop(at + duration + 0.01);
    });
  }
  private stopEffects() {
    for (const osc of this.nodes) {
      try {
        osc.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.nodes.clear();
  }
  dispose() {
    this.disposed = true;
    this.music?.pause();
    if (this.music) {
      this.music.removeAttribute('src');
      this.music.load();
    }
    this.stopEffects();
    if (this.context) void this.context.close().catch(() => {});
    this.music = null;
    this.context = null;
  }
}
