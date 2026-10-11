"""Original 16-bar ambient miniature, D major pentatonic, 75 BPM. No sampled recordings."""
from pathlib import Path
import numpy as np
import wave
sr=32000;beat=.8;length=64*beat;n=round(sr*length)
audio=np.zeros((n,2),dtype=np.float64)
def add(note,at,dur,amp,kind='bell',pan=0):
 f=440*2**((note-69)/12);t=np.arange(round(dur*sr))/sr
 if kind=='pad':
  env=np.sin(np.pi*np.minimum(t/1.7,1)/2)**2*np.sin(np.pi*np.minimum((dur-t)/2.3,1)/2)**2
  sig=(np.sin(2*np.pi*f*t)+.32*np.sin(2*np.pi*f*1.002*t)+.18*np.sin(2*np.pi*f*2*t))*.65
 else:
  env=(1-np.exp(-t*35))*np.exp(-t/(1.6 if kind=='bell' else 2.6))
  sig=np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*f*2*t)*np.exp(-t*3)+.08*np.sin(2*np.pi*f*3*t)*np.exp(-t*7)
 sig*=env*amp
 indices=(np.arange(len(t))+round(at*sr))%n
 np.add.at(audio[:,0],indices,sig*np.sqrt((1-pan)/2))
 np.add.at(audio[:,1],indices,sig*np.sqrt((1+pan)/2))
chords=[[50,57,61,66],[47,54,57,62],[43,50,57,59],[45,52,57,59]]
for bar,chord in enumerate(chords):
 for j,note in enumerate(chord):add(note,bar*16*beat-1.4,16*beat+3.3,.052,'pad',(j-1.5)*.35)
 add(chord[0]-12,bar*16*beat,16*beat,.045,'pad',0)
phrases=[[74,None,78,81,78,None,76,74],[71,74,None,78,76,None,74,None],[74,None,81,83,81,78,None,76],[76,74,None,71,69,None,74,None], [78,81,None,86,83,None,81,78],[76,None,78,81,78,74,None,71],[74,76,None,81,83,81,None,78],[76,None,74,71,69,None,74,None]]
for phrase,notes in enumerate(phrases):
 for step,note in enumerate(notes):
  if note is not None:add(note,(phrase*8+step)*beat,4,.067,'bell',np.sin(phrase+step)*.48)
for i in range(64):
 chord=chords[i//16];add(chord[i%4]+12,(i+.5)*beat,2.8,.017,'pluck',np.sin(i*2.4)*.75)
# Circular early reflections and diffuse tails make the seam continuous.
dry=audio.copy()
for delay,gain in [(.17,.22),(.31,.18),(.47,.14),(.73,.11),(1.13,.09),(1.71,.07),(2.3,.045)]:
 audio+=np.roll(dry[:,::-1] if delay<1 else dry,round(delay*sr),axis=0)*gain
peak=np.max(np.abs(audio));audio*=.72/peak
out=Path(__file__).resolve().parent.parent/'tidal-dream.wav'
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((audio*32767).astype('<i2').tobytes())
print(f'Original score: {length:.1f}s stereo; peak {np.max(np.abs(audio)):.3f}; RMS {np.sqrt(np.mean(audio**2)):.3f}')
