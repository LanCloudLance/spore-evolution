import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import Game from '../app/game/Game';
import '../app/globals.css';

function OfflineGame() {
  const [practice, setPractice] = useState(location.hash === '#ocean');
  useEffect(() => {
    const update = () => setPractice(location.hash === '#ocean');
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return (
    <Game key={practice ? 'ocean-practice' : 'main'} oceanPractice={practice} />
  );
}

createRoot(document.getElementById('root')!).render(<OfflineGame />);
