import { animate } from 'motion';

const COLORS = ['--green', '--orange', '--indigo', '--rose', '--sky', '--accent'];

function palette(): string[] {
  const cs = getComputedStyle(document.documentElement);
  return COLORS.map((v) => cs.getPropertyValue(v).trim() || '#1e6a51');
}

/** A small burst of coloured sparks around a checkbox. */
export function sparkBurst(rect: DOMRect): void {
  const cols = palette();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('i');
    d.className = 'spark';
    d.style.left = `${cx}px`;
    d.style.top = `${cy}px`;
    d.style.background = cols[i % cols.length];
    document.body.appendChild(d);
    const a = (i / 12) * Math.PI * 2;
    const r = 26 + Math.random() * 14;
    animate(d, { x: [0, Math.cos(a) * r], y: [0, Math.sin(a) * r], scale: [1.2, 0], opacity: [1, 0] }, { duration: 0.6, ease: 'easeOut' });
    setTimeout(() => d.remove(), 700);
  }
}

/** Confetti for finishing every task of the day. */
export function confetti(): void {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const W = innerWidth;
  const H = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = W * dpr;
  c.height = H * dpr;
  const g = c.getContext('2d');
  if (!g) return c.remove();
  g.scale(dpr, dpr);
  const cols = palette();
  const P = Array.from({ length: 150 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80,
    y: H * 0.38,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 5,
    a: Math.random() * 6.3,
    va: (Math.random() - 0.5) * 0.3,
    c: cols[(Math.random() * cols.length) | 0],
  }));
  const t0 = performance.now();
  const frame = (t: number) => {
    const e = t - t0;
    g.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.33;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.globalAlpha = Math.max(0, 1 - e / 2400);
      g.fillStyle = p.c;
      g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      g.restore();
    }
    if (e < 2500) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
