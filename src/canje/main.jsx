// Mystery Pack · página de canje (chacalde.com/canje, only while the campaign is on; the console has a preview).
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { loadFonts } from './lib.js';
import { setSpriteUrl } from './sound.js';
import './canje.css';

const root = document.getElementById('app');
const cfg = JSON.parse(root.dataset.cfg);
loadFonts(cfg.assets);
setSpriteUrl(`${cfg.assets}/sfx.mp3`);
createRoot(root).render(<App cfg={cfg} />);
