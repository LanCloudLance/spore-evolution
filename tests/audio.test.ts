import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../app/game/audio.ts';
import * as audioSettings from '../app/game/audio.ts';
void test('volume settings restore across chapter instances and invalid storage cannot produce unsafe gain', () => {
  assert.equal(typeof audioSettings.readAudioLevels, 'function');
  assert.deepEqual(
    audioSettings.readAudioLevels({
      getItem: () => '{"music":0.12,"effects":0.08}',
    }),
    { music: 0.12, effects: 0.08, ambience: 0 },
  );
  assert.deepEqual(
    audioSettings.readAudioLevels({
      getItem: () => '{"music":200,"effects":-3}',
    }),
    { music: 1, effects: 0, ambience: 0 },
  );
  assert.deepEqual(
    audioSettings.readAudioLevels({
      getItem: () => '{"music":"loud","effects":null}',
    }),
    { music: 0.3, effects: 0.14, ambience: 0 },
  );
  assert.deepEqual(
    audioSettings.readAudioLevels({
      getItem: () => {
        throw new Error('Storage disabled');
      },
    }),
    { music: 0.3, effects: 0.14, ambience: 0 },
  );
});
void test('habitat music changes only on a real transition and scene feedback never stacks a second repeating melody', async () => {
  assert.equal(typeof GameAudio.prototype.setHabitat, 'function');
  const previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const previousContext = Object.getOwnPropertyDescriptor(
    globalThis,
    'AudioContext',
  );
  const tracks: Music[] = [];
  let plays = 0,
    voices = 0;
  class Music {
    src: string;
    loop = false;
    volume = 0;
    muted = false;
    constructor(src: string) {
      this.src = src;
      tracks.push(this);
    }
    play() {
      plays++;
      return Promise.resolve();
    }
    pause() {}
    addEventListener() {}
    removeAttribute() {}
    load() {}
  }
  const parameter = {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
  class Context {
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      return { gain: { ...parameter }, connect() {}, disconnect() {} };
    }
    createOscillator() {
      return {
        frequency: { ...parameter },
        connect() {},
        disconnect() {},
        start() {
          voices++;
        },
        stop() {},
      };
    }
    close() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'Audio', {
    value: Music,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'AudioContext', {
    value: Context,
    configurable: true,
  });
  const sound = new GameAudio();
  try {
    sound.setHabitat('ocean');
    sound.setPlaying(true);
    assert.equal(await sound.unlock(), true);
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].src, '/audio/life/ocean.mp3');
    const before = plays;
    sound.setHabitat('ocean');
    assert.equal(
      plays,
      before,
      'each animation frame must not restart the score',
    );
    sound.setScene('explore');
    sound.setScene('danger');
    sound.setScene('evolution');
    assert.equal(
      voices,
      0,
      'the composed music must not fight a repeating oscillator melody',
    );
    sound.cue('birth');
    assert.ok(voices > 0, 'real events retain audible feedback');
    sound.setMuted(true);
    sound.setHabitat('land');
    assert.equal(tracks[0].src, '/audio/life/land.mp3');
    assert.equal(plays, before, 'changing chapters must respect silence');
    sound.setMuted(false);
    await Promise.resolve();
    assert.equal(plays, before + 1);
    sound.setPlaying(false);
    sound.setHabitat('shore');
    assert.equal(plays, before + 1, 'a paused chapter change stays paused');
  } finally {
    sound.dispose();
    if (previousAudio)
      Object.defineProperty(globalThis, 'Audio', previousAudio);
    else Reflect.deleteProperty(globalThis, 'Audio');
    if (previousContext)
      Object.defineProperty(globalThis, 'AudioContext', previousContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});
void test('sound waits for a gesture, pauses, mutes, resumes and releases its resources', async () => {
  const previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio'),
    previousContext = Object.getOwnPropertyDescriptor(
      globalThis,
      'AudioContext',
    );
  let contexts = 0;
  let created = 0,
    plays = 0,
    pauses = 0,
    closed = 0,
    tones = 0,
    stopped = 0;
  class Music {
    loop = false;
    volume = 0;
    preload = '';
    muted = false;
    constructor() {
      created++;
    }
    play() {
      plays++;
      return Promise.resolve();
    }
    pause() {
      pauses++;
    }
    addEventListener() {}
    removeAttribute() {}
    load() {}
  }
  const parameter = {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
  class Context {
    constructor() {
      contexts++;
    }
    state = 'suspended';
    currentTime = 0;
    destination = {};
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      closed++;
      return Promise.resolve();
    }
    createGain() {
      return { gain: { ...parameter }, connect() {}, disconnect() {} };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { ...parameter },
        connect() {},
        disconnect() {},
        onended: null as (() => void) | null,
        start() {
          tones++;
        },
        stop() {
          stopped++;
        },
      };
    }
  }
  Object.defineProperty(globalThis, 'Audio', {
    value: Music,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'AudioContext', {
    value: Context,
    configurable: true,
  });
  const sound = new GameAudio();
  try {
    sound.setPlaying(true);
    assert.equal(created, 0);
    assert.equal(await sound.unlock(), true);
    assert.equal(created, 1);
    assert.equal(plays, 1);
    sound.cue('food');
    assert.equal(tones, 2);
    sound.cue('food');
    assert.equal(tones, 2, 'pickup sound is rate limited');
    sound.setPlaying(false);
    assert.ok(pauses > 0);
    assert.ok(stopped > 0);
    sound.setMuted(true);
    sound.cue('birth');
    assert.equal(tones, 2);
    sound.setPlaying(true);
    assert.equal(plays, 1);
    sound.setMuted(false);
    await Promise.resolve();
    assert.equal(plays, 2);
    sound.setVolumes({ music: 2, ambience: -1, effects: 0.4 });
    sound.setScene('explore');
    const sceneTones = tones;
    sound.setScene('explore');
    assert.equal(tones, sceneTones, 'same scene creates no duplicate voices');
    sound.setScene('danger');
    sound.setScene('migration');
    sound.setScene('evolution');
    assert.equal(contexts, 1);
    sound.setPlaying(false);
    const pausedTones = tones;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(tones, pausedTones, 'pause cancels scene scheduling');
    sound.dispose();
    assert.equal(closed, 1);
    assert.equal(await sound.unlock(), false);
  } finally {
    if (previousAudio)
      Object.defineProperty(globalThis, 'Audio', previousAudio);
    else Reflect.deleteProperty(globalThis, 'Audio');
    if (previousContext)
      Object.defineProperty(globalThis, 'AudioContext', previousContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});
void test('pausing a pending playback is not a failure, and a successful retry clears a real playback failure', async () => {
  const oldAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const oldContext = Object.getOwnPropertyDescriptor(
    globalThis,
    'AudioContext',
  );
  const requests: { resolve: () => void; reject: (error: Error) => void }[] =
    [];
  class Music {
    play() {
      return new Promise<void>((resolve, reject) =>
        requests.push({ resolve, reject }),
      );
    }
    pause() {}
    addEventListener() {}
    removeAttribute() {}
    load() {}
  }
  class Context {
    state = 'running';
    destination = {};
    createGain() {
      return { gain: { value: 0 }, connect() {} };
    }
    close() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'Audio', {
    value: Music,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'AudioContext', {
    value: Context,
    configurable: true,
  });
  const sound = new GameAudio();
  try {
    sound.setPlaying(true);
    const first = sound.unlock();
    sound.setPlaying(false);
    requests[0].reject(new DOMException('Interrupted by pause', 'AbortError'));
    assert.equal(await first, true);
    assert.equal(sound.available, true);
    sound.setPlaying(true);
    const retry = sound.unlock();
    requests[1].resolve();
    requests[2].resolve();
    assert.equal(await retry, true);
    sound.setPlaying(false);
    sound.setPlaying(true);
    requests[3].reject(new Error('Playback unavailable'));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(sound.available, false);
    const recovered = sound.unlock();
    requests[4].resolve();
    assert.equal(await recovered, true);
    assert.equal(sound.available, true);
  } finally {
    sound.dispose();
    if (oldAudio) Object.defineProperty(globalThis, 'Audio', oldAudio);
    else Reflect.deleteProperty(globalThis, 'Audio');
    if (oldContext)
      Object.defineProperty(globalThis, 'AudioContext', oldContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});
