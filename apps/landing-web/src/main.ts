import { contactEmail } from './config';
import { renderContact } from './contact';
renderContact(document.getElementById('contact')!, contactEmail);

(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motion.matches;
  let frameId = 0;
  const hero = document.querySelector<HTMLElement>('.hero')!;

  // Hero field: a quiet grid of points that brighten as NFC waves pass through.
  // Runs only while the hero is on screen and not paused.
  const canvas = document.getElementById('field') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  let points: [number, number][] = [];
  let w = 0, h = 0, clock = 0, last = 0, running = false, paused = false, visible = true;
  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    points = [];
    const step = w < 600 ? 26 : 32;
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) points.push([x, y]);
  }
  function origin() {
    const tag = document.querySelector<HTMLElement>('.hero .tag')!;
    const cr = canvas.getBoundingClientRect(), sr = tag.getBoundingClientRect();
    return [sr.left - cr.left + sr.width / 2, sr.top - cr.top + sr.height / 2];
  }
  function paint() {
    const [ox, oy] = origin();
    const cycle = (clock % 6400) / 6400;
    ctx.clearRect(0, 0, w, h);
    const waves = [];
    if (!reduce && cycle > 0.3) for (let k = 0; k < 3; k++) waves.push((cycle - 0.3 - k * 0.04) * 1300);
    for (const [x, y] of points) {
      const d = Math.hypot(x - ox, y - oy);
      let a = 0.08 * Math.max(0, 1 - d / 900);
      for (const r of waves) { if (r > 0) { const g = Math.exp(-((d - r) ** 2) / 900); a += g * 0.55 * Math.max(0, 1 - r / 1300); } }
      ctx.fillStyle = `rgba(126,224,192,${Math.min(a, 0.7).toFixed(3)})`;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  function frame(now: number) {
    if (!running) return;
    clock += Math.min(now - last, 100); last = now;
    paint();
    frameId = requestAnimationFrame(frame);
  }
  function sync() {
    const should = !reduce && !paused && visible && !document.hidden;
    hero.classList.toggle('is-still', paused || !visible);
    if (should && !running) { running = true; last = performance.now(); frameId = requestAnimationFrame(frame); }
    if (!should) { running = false; cancelAnimationFrame(frameId); }
  }
  motion.addEventListener('change', () => { reduce = motion.matches; sync(); paint(); });
  document.addEventListener('visibilitychange', sync);
  size(); paint(); sync();
  window.addEventListener('resize', () => { size(); paint(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 }).observe(hero);
  }

  // Pause control for all looping motion in the hero.
  const pauseBtn = document.getElementById('pauseBtn')!;
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'Animation fortsetzen' : 'Animation anhalten');
    sync();
  });

  // Statement: words brighten as the sentence scrolls through the viewport.
  // Scroll story: the step follows the scroll position through the tall section.
  const words = [...document.querySelectorAll('#statement .w')];
  const statement = document.getElementById('statement')!;
  const story = document.querySelector<HTMLElement>('.story')!;
  function onScroll() {
    const vh = window.innerHeight;
    const sr = statement.getBoundingClientRect();
    const sp = Math.min(1, Math.max(0, (vh * 0.85 - sr.top) / (sr.height + vh * 0.45)));
    const lit = Math.round(sp * words.length);
    words.forEach((el, i) => el.classList.toggle('on', i < lit));

    const r = story.getBoundingClientRect();
    const total = r.height - vh;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    document.getElementById('storyProgress')!.setAttribute('width', String(Math.round(p * 1000)));
    story.dataset.step = String(Math.min(2, Math.floor(p * 3)));
  }
  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
  onScroll();

  // Offline card replays its sequence when it comes into view (resting state is the finished state).
  const card = document.getElementById('offlineCard')!;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && !reduce) { card.classList.remove('play'); void card.offsetWidth; card.classList.add('play'); }
    }, { threshold: 0.5 }).observe(card);
  }
})();
