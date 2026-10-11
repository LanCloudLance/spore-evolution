"""Original, quiet instrumental scores for the five biological habitats.

No sampled or third-party music. Requires the existing local numpy and ffmpeg.
Circular note tails keep the 128-second phrase continuous at the loop seam.
"""
from pathlib import Path
import json
import subprocess
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 32000
SECONDS = 128
SIZE = RATE * SECONDS
SCORES = {
    "pond": {"root": 50, "color": "small, curious, gently plucked", "melody": [12, 16, 19, 14, 12, 9, 7, 14], "pluck": .8},
    "ocean": {"root": 45, "color": "wide, slow, floating", "melody": [12, 19, 16, 14, 19, 21, 16, 12], "pluck": .45},
    "shore": {"root": 50, "color": "tentative steps, warm flowing rhythm", "melody": [7, 12, 14, 16, 14, 19, 16, 12], "pluck": .65},
    "land": {"root": 43, "color": "woodland, soft strings and rounded plucks", "melody": [12, 14, 19, 16, 21, 19, 14, 12], "pluck": .85},
    "colony": {"root": 48, "color": "home, gentle communal resolution", "melody": [12, 16, 19, 21, 19, 16, 14, 12], "pluck": .7},
}

def hz(note):
    return 440 * 2 ** ((note - 69) / 12)

def compose(config):
    audio = np.zeros((SIZE, 2), dtype=np.float64)

    def note(at, length, pitch, level, pan=0, pluck=False):
        t = np.arange(round(length * RATE), dtype=np.float64) / RATE
        frequency = hz(pitch)
        if pluck:
            # Rounded string tone: the upper partials decay first, without a click.
            tone = (np.sin(2 * np.pi * frequency * t)
                    + .2 * np.sin(4 * np.pi * frequency * t) * np.exp(-t * 2)
                    + .07 * np.sin(6 * np.pi * frequency * t) * np.exp(-t * 4))
            envelope = (1 - np.exp(-t / .035)) * np.exp(-t / 1.6)
            envelope *= np.minimum(1, (length - t) / .5)
        else:
            # Slow bowed pad; modest vibrato and no sharp saw/square components.
            phase = 2 * np.pi * frequency * t + .04 * np.sin(2 * np.pi * .22 * t)
            tone = np.sin(phase) + .12 * np.sin(2 * phase)
            envelope = np.minimum(1, t / 1.5) * np.minimum(1, (length - t) / 2.5)
            envelope = np.maximum(0, envelope) ** 1.5
        tone *= envelope * level
        indices = (round(at * RATE) + np.arange(len(tone))) % SIZE
        for channel, gain in [(0, np.sqrt((1 - pan) / 2)), (1, np.sqrt((1 + pan) / 2))]:
            audio[indices, channel] += tone * gain
            # Quiet, diffuse room reflection rather than a metallic repeat.
            audio[(indices + round(.19 * RATE)) % SIZE, 1 - channel] += tone * gain * .12

    root = config["root"]
    progression = [0, 5, 9, 7, 0, 9, 5, 7, 0, 5, 9, 7, 5, 9, 7, 0]
    motif = config["melody"]
    for bar, offset in enumerate(progression):
        base = root + offset
        note(bar * 8, 11, base - 12, .042, -.08)
        for interval, pan in [(0, -.35), (7, .3), (15 if offset == 9 else 16, -.1)]:
            note(bar * 8 + .3, 10.5, base + interval, .018, pan)
        # Four phrases with different spacing, register, and rests; no short ostinato loop.
        phrase = bar // 4
        for beat in range(4):
            if (bar + beat + phrase) % 5 == 3:
                continue
            pitch = root + motif[(bar * 2 + beat + phrase * 3) % len(motif)]
            if phrase == 2 and beat == 2:
                pitch += 7
            level = (.042 if phrase in (0, 3) else .052) * config["pluck"]
            note(bar * 8 + .65 + beat * 1.8, 4.8, pitch, level, (-.25, .2, -.1, .3)[beat], True)
        if bar % 4 == 2:
            note(bar * 8 + 4.5, 6, root + 19, .02, .15)
    # Band-limit the mix to soften high partials; circular filtering preserves the seam.
    spectrum = np.fft.rfft(audio, axis=0)
    frequencies = np.fft.rfftfreq(SIZE, 1 / RATE)
    spectrum *= (1 / np.sqrt(1 + (frequencies / 2200) ** 8))[:, None]
    audio = np.fft.irfft(spectrum, n=SIZE, axis=0)
    # A brief symmetric soft edge also absorbs MP3 encoder padding at loop restart.
    edge = round(.06 * RATE)
    ramp = np.sin(np.linspace(0, np.pi / 2, edge)) ** 2
    audio[:edge] *= ramp[:, None]
    audio[-edge:] *= ramp[::-1, None]
    audio -= audio.mean(axis=0)
    rms = np.sqrt(np.mean(audio ** 2))
    audio *= min(.1 / rms, .5 / np.max(np.abs(audio)))
    return audio

def main():
    output = ROOT / 'public/audio/life'
    output.mkdir(parents=True, exist_ok=True)
    report = {}
    with tempfile.TemporaryDirectory(prefix='spore-score-') as temp:
        for name, config in SCORES.items():
            audio = compose(config)
            wav = Path(temp) / f'{name}.wav'
            with wave.open(str(wav), 'wb') as stream:
                stream.setnchannels(2)
                stream.setsampwidth(2)
                stream.setframerate(RATE)
                stream.writeframes((audio * 32767).astype('<i2').tobytes())
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-codec:a', 'libmp3lame', '-b:a', '128k', str(output / f'{name}.mp3')], check=True)
            report[name] = {'seconds': SECONDS, 'rms_db': round(float(20 * np.log10(np.sqrt(np.mean(audio ** 2)))), 2), 'peak_db': round(float(20 * np.log10(np.max(np.abs(audio)))), 2), 'seam_step': round(float(np.max(np.abs(audio[0] - audio[-1]))), 6), 'mood': config['color']}
            print(name, report[name], flush=True)
    (output / 'scores.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
