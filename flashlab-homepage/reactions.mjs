// Shared "reaction wall" engine.
//
// One phrase every 400ms (2.5 per second) drawn from a shuffled bag of
// ~1,800 unique lines. At that rate the bag lasts about 12 minutes before a
// phrase can appear again. Used by both the dashboard and the landing page.

const seeds = [
  "omg 😲",
  "Jesus called on video call? 😆",
  "I’m blown away!",
  "How did a 2-year-old video call me? Where’s your mama? 😂",
  "No wayyyyyy!",
  "Wait, did you just send me 50k? Omg don’t fuckkin play with me lol",
  "I’m sooo excited! You mean all that was a prank?",
  "Am I dreaming?",
  "Who gave this baby my number?",
  "My jaw just left the group chat 😭",
  "Somebody come and see this!",
  "Wait. Pause. Rewind.",
  "I need a minute 😂",
  "You have to be joking!",
  "My brain is buffering…",
  "This is a plot twist and a half!",
  "My face said everything 😲",
  "I almost dropped my phone!",
  "This reaction deserves an award!",
  "You got me good!",
  "I was already planning my speech 😂",
  "I need to sit down for this one.",
  "My eyebrows just touched the ceiling!",
  "Somebody pinch me!",
  "The way I screamed 😭",
  "You really had me believing that!",
  "I wasn’t ready for this!",
  "My mama needs to hear this story!",
  "This is going straight to the group chat!",
  "I just forgot how to blink 😳",
  "Wait, the baby has Wi-Fi?",
  "Who taught the toddler to press call?",
  "That was a professional-level gotcha!",
  "I laughed so hard I lost my slippers 😂",
  "My serious face lasted two seconds.",
  "You owe me a new set of nerves!",
  "That reveal was criminally funny!",
  "I nearly called the whole family!",
  "I thought today was a normal day.",
  "My tea nearly flew across the room!",
  "You cannot be serious right now 😆",
  "My reaction has its own reaction!",
  "I need this moment on replay!",
  "I was fooled with confidence 😂",
  "Even my phone is confused.",
  "The suspense almost finished me!",
  "Hold on, let me put my glasses on.",
  "This is premium group-chat material!",
  "That baby has better signal than me!",
  "My heart did a little backflip!",
  "I just said WHAT in five languages.",
  "Who approved this level of chaos?",
  "That twist deserves a standing ovation!",
  "I had a whole celebration ready 😭",
  "I’m laughing and questioning everything!",
  "I went from shocked to howling!",
  "My neighbours heard that scream 😂",
  "You really chose chaos today!",
  "That was the fastest mood swing ever!",
  "I need popcorn for this plot twist!",
];

const tails = [
  "",
  " I cannot stop laughing.",
  " Somebody explain this to me.",
  " My face is still frozen.",
  " That reveal was everything.",
  " Please tell me you recorded my reaction.",
  " Let me catch my breath.",
  " I am sending this to my bestie.",
  " My day just got interesting.",
  " I have so many questions.",
  " This deserves an instant replay.",
  " The group chat will hear about this.",
  " I walked straight into that one.",
  " I should have seen it coming.",
  " My poker face has resigned.",
  " My whole mood just changed.",
  " I laughed before I could speak.",
  " Tell me how you thought of that.",
  " The timing was too perfect.",
  " I was not emotionally prepared.",
  " That reaction was completely unplanned.",
  " I need a behind-the-scenes explanation.",
  " My laugh just woke the house.",
  " This story is getting retold forever.",
  " I can’t even finish my sentence.",
  " Give me a second to recover.",
  " I really believed the plot twist.",
  " You just made my afternoon.",
  " I almost stood up to applaud.",
  " The surprise got me twice.",
];

const phrases = [];
for (const tail of tails) for (const seed of seeds) phrases.push(seed + tail);
for (let i = phrases.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [phrases[i], phrases[j]] = [phrases[j], phrases[i]];
}

const desktopSlots = [
  [3, 20], [65, 19], [2, 67], [64, 69],
  [7, 43], [62, 42], [27, 8], [28, 79],
];
const mobileSlots = [
  [2, 19], [42, 29], [2, 68], [38, 78],
  [3, 41], [40, 56], [20, 7], [15, 87],
];
const variants = ["", "alt", "ink", "hand"];

/**
 * @param {object} options
 * @param {HTMLElement} options.layer   container the bubbles are appended to
 * @param {HTMLElement} options.stage   positioned ancestor used for clamping
 * @param {HTMLElement} [options.toggle] pause/play button
 * @param {number} [options.interval]   ms between pops (default 400 = 2.5/sec)
 * @param {number} [options.lifetime]   ms before a bubble is force-removed
 * @param {number} [options.plainEvery] every Nth bubble is plain text, no quote marks
 * @param {boolean} [options.staticOnReduced] keep a few static bubbles for reduced motion
 */
export function startReactions({
  layer,
  stage,
  toggle,
  interval = 400,
  lifetime = 3400,
  plainEvery = 0,
  staticOnReduced = false,
}) {
  if (!layer || !stage) return () => {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = () => innerWidth <= 650;
  let paused = reduced.matches;
  let offscreen = false;
  let index = 0;
  let slot = 0;
  let timer;

  function makeBubble(phrase, position, tilt, plain = false) {
    const el = document.createElement("span");
    el.className =
      "reaction " + (plain ? "plain" : variants[index % variants.length]);
    el.textContent = plain ? phrase : "“" + phrase + "”";
    el.style.setProperty("--tilt", tilt + "deg");
    el.style.maxWidth = mobile() ? "56%" : "32%";
    el.style.left = position[0] + "%";
    el.style.top = position[1] + "%";
    return el;
  }

  function place(el, x, y) {
    el.style.left =
      Math.max(12, Math.min(stage.clientWidth - el.offsetWidth - 12, (stage.clientWidth * x) / 100)) + "px";
    el.style.top =
      Math.max(48, Math.min(stage.clientHeight - el.offsetHeight - 42, (stage.clientHeight * y) / 100)) + "px";
  }

  function emit() {
    if (paused || offscreen || document.hidden) return;
    const n = slot++ % desktopSlots.length;
    const [x, y] = (mobile() ? mobileSlots : desktopSlots)[n];
    const plain = plainEvery > 0 && index % plainEvery === plainEvery - 1;
    const el = makeBubble(phrases[index++ % phrases.length], [x, y], n % 2 ? 3 : -3, plain);
    layer.append(el);
    place(el, x, y);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), lifetime + 400);
  }

  function showStatic() {
    layer.replaceChildren();
    for (const [i, [x, y]] of desktopSlots.slice(0, 3).entries()) {
      const el = makeBubble(phrases[i], [x, y], i % 2 ? 2 : -2);
      el.classList.add("is-static");
      layer.append(el);
      place(el, x, y);
    }
  }

  function update() {
    if (toggle) {
      toggle.textContent = paused ? "▶ Play reactions" : "Ⅱ Pause reactions";
      toggle.setAttribute("aria-pressed", String(paused));
    }
    clearInterval(timer);
    layer.replaceChildren();
    if (paused && staticOnReduced) showStatic();
    if (paused) return;
    emit();
    timer = setInterval(emit, interval);
  }

  if (toggle) toggle.onclick = () => { paused = !paused; update(); };
  reduced.addEventListener("change", (event) => { paused = event.matches; update(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) layer.replaceChildren();
  });
  if ("IntersectionObserver" in window) {
    let wasOffscreen = false;
    new IntersectionObserver(
      ([entry]) => {
        const nowOffscreen = !entry.isIntersecting;
        if (nowOffscreen === wasOffscreen) return; // ignore the initial callback
        wasOffscreen = offscreen = nowOffscreen;
        clearInterval(timer);
        if (offscreen) layer.replaceChildren();
        else if (paused) { if (staticOnReduced) showStatic(); }
        else { emit(); timer = setInterval(emit, interval); }
      },
      { threshold: 0.01 },
    ).observe(stage);
  }
  update();
  return () => { clearInterval(timer); layer.replaceChildren(); };
}
