'use client';
import { useId, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { DEFAULT_AUDIO_LEVELS, GameAudio, readAudioLevels } from './audio';
import type { AudioHabitat } from './audio';
import { SettingsPopover } from './SettingsPopover';
const subscribe = () => () => {};
const volumeSnapshot = () => JSON.stringify(readAudioLevels());
const serverSnapshot = () => JSON.stringify(DEFAULT_AUDIO_LEVELS);
export function AudioVolumes({
  audio,
  habitat = 'pond',
  onOpen,
}: {
  audio: RefObject<GameAudio | null>;
  habitat?: AudioHabitat;
  onOpen?: () => void;
}) {
  const saved = useSyncExternalStore(subscribe, volumeSnapshot, serverSnapshot);
  const [editedLevels, setLevels] = useState<
    typeof DEFAULT_AUDIO_LEVELS | null
  >(null);
  const levels =
    editedLevels ?? (JSON.parse(saved) as typeof DEFAULT_AUDIO_LEVELS);
  const id = useId();
  const change = (type: 'music' | 'effects', value: number) => {
    const next = { ...levels, [type]: value / 100 };
    setLevels(next);
    audio.current ??= new GameAudio(habitat);
    audio.current.setVolumes(next);
  };
  return (
    <SettingsPopover label="音量" className="audio-volumes" onOpen={onOpen}>
      <strong>把声音调到舒服的大小</strong>
      {(['music', 'effects'] as const).map((type) => (
        <label
          className="audio-volume-row"
          key={type}
          htmlFor={`${id}-${type}`}
        >
          <span>
            {type === 'music' ? '背景音乐' : '动作音效'}{' '}
            <output>{Math.round(levels[type] * 100)}%</output>
          </span>
          <input
            id={`${id}-${type}`}
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(levels[type] * 100)}
            onChange={(e) => change(type, Number(e.target.value))}
          />
        </label>
      ))}
      <small>分别调节。开启声音后生效，暂停和静音时仍保持安静。</small>
    </SettingsPopover>
  );
}
