import playRaw from './icons/play.svg?raw';
import playOptical from './icons/play.svg?optical';
import triangleRaw from './icons/triangle.svg?raw';
import triangleOptical from './icons/triangle.svg?optical';

interface IconPair {
  readonly name: string;
  readonly raw: string;
  readonly optical: string;
}

const ICONS: ReadonlyArray<IconPair> = [
  { name: 'play', raw: playRaw, optical: playOptical },
  { name: 'triangle', raw: triangleRaw, optical: triangleOptical },
];

function row({ name, raw, optical }: IconPair): string {
  return `
    <div class="row">
      <div class="badge">${raw}</div>
      <div class="badge">${optical}</div>
      <code>${name}</code>
    </div>
  `;
}

const root = document.getElementById('root');
if (root) root.innerHTML = ICONS.map(row).join('');
