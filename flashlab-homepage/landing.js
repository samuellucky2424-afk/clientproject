import { startReactions } from './reactions.mjs';

// One every 400ms (2.5/sec), ~1,800 unique lines before any repeat.
try {
  startReactions({
    layer: document.getElementById('reactionsLayer'),
    stage: document.getElementById('reactions'),
    toggle: document.getElementById('motion'),
    plainEvery: 5,
    staticOnReduced: true,
  });
} catch (error) {
  console.warn('Reaction wall unavailable:', error);
}

// Gentle section reveals. Reduced-motion users get everything at once via CSS.
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add('is-visible'));
}

// The brief calls the two pranks [V, C] — let those keys work too.
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return;
  if (document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  if (!['v', 'c'].includes(key)) return;
  const card = document.querySelector(`.prank-card--${key}`);
  if (card) location.assign(card.href);
});
