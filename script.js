const penElement = document.getElementById("pen");
const movesElement = document.getElementById("moves-count");
const chargeElement = document.getElementById("charge-count");
const statusElement = document.getElementById("status-text");
const goalElement = document.getElementById("goal-text");
const tutorialCallout = document.getElementById("tutorial-callout");
const mathPromptElement = document.getElementById("math-prompt");
const gameFrameElement = document.querySelector(".game-frame");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const replayButton = document.getElementById("replay-button");

const ctaButtons = [
  document.getElementById("top-cta"),
  document.getElementById("main-cta"),
  document.getElementById("overlay-cta"),
].filter(Boolean);

const adTargetUrl = "https://play.google.com/store";
const animalSize = 58;
const padding = 10;
const runDurationMs = 5000;
const bestScoreStorageKey = "playable5_best_score";

const animalDefinitions = [
  { id: "chick", emoji: "🐥", label: "Chick", value: 5, x: 26, y: 32, vx: 0.23, vy: 0.18 },
  { id: "pig", emoji: "🐷", label: "Pig", value: 8, x: 204, y: 50, vx: -0.18, vy: 0.2 },
  { id: "sheep", emoji: "🐑", label: "Sheep", value: 4, x: 118, y: 188, vx: 0.21, vy: -0.16 },
  { id: "cow", emoji: "🐮", label: "Cow", value: 7, x: 232, y: 208, vx: -0.17, vy: -0.14 },
  { id: "duck", emoji: "🦆", label: "Duck", value: 2, x: 58, y: 224, vx: 0.16, vy: -0.19 },
];

let state = createGameState();
let animalElements = new Map();
let frameHandle = 0;
let lastFrameTime = 0;
let promptBumpHandle = 0;
let celebrationHandle = 0;
let roundAdvanceHandle = 0;
const storedBestScore = Number(window.localStorage.getItem(bestScoreStorageKey) || "0");

function createGameState() {
  return {
    animals: animalDefinitions.map((animal, index) => ({
      ...animal,
      done: false,
      phase: index * 0.9,
    })),
    roundIndex: 0,
    taps: 0,
    score: 0,
    bestScore: Number.isFinite(storedBestScore) ? storedBestScore : 0,
    streak: 0,
    paused: false,
    roundLocked: false,
    tutorialDone: false,
    currentQuestion: null,
    timeLeftMs: runDurationMs,
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function generateQuestion() {
  const pick = randomInt(0, 2);
  if (pick === 0) {
    const left = randomInt(1, 6);
    const right = randomInt(1, 6);
    return { prompt: `${left} + ${right}`, answer: left + right };
  }

  if (pick === 1) {
    const answer = randomInt(1, 8);
    const right = randomInt(1, 4);
    return { prompt: `${answer + right} - ${right}`, answer };
  }

  const left = randomInt(2, 4);
  const right = randomInt(2, 3);
  return { prompt: `${left} × ${right}`, answer: left * right };
}

function assignRoundValues() {
  const question = generateQuestion();
  const values = new Set([question.answer]);

  while (values.size < state.animals.length) {
    values.add(randomInt(1, 12));
  }

  const shuffledValues = shuffle([...values]);
  state.currentQuestion = question;

  state.animals.forEach((animal, index) => {
    animal.value = shuffledValues[index];
    animal.done = false;
    animal.exiting = false;
    animal.spawnIn = true;
    animal.phase = index * 0.9 + randomInt(0, 10) * 0.1;
    animal.x = randomInt(padding, 250);
    animal.y = randomInt(padding, 250);
    animal.vx = (Math.random() * 0.26 + 0.12) * (Math.random() > 0.5 ? 1 : -1);
    animal.vy = (Math.random() * 0.22 + 0.12) * (Math.random() > 0.5 ? 1 : -1);
  });

  window.setTimeout(() => {
    state.animals.forEach((animal) => {
      animal.spawnIn = false;
    });
    paintAnimals();
  }, 420);
}

function renderPen() {
  penElement.innerHTML = "";
  animalElements = new Map();
  const fragment = document.createDocumentFragment();

  state.animals.forEach((animal) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "animal";
    button.dataset.id = animal.id;
    button.setAttribute("aria-label", animal.label);

    const face = document.createElement("div");
    face.className = "animal-face";
    face.textContent = animal.emoji;

    button.appendChild(face);
    fragment.appendChild(button);
    animalElements.set(animal.id, button);
  });

  penElement.appendChild(fragment);
  paintAnimals();
}

function paintAnimals() {
  state.animals.forEach((animal) => {
    const element = animalElements.get(animal.id);
    if (!element) {
      return;
    }

    const bob = Math.sin(animal.phase) * 3;
    const tilt = Math.sin(animal.phase * 0.7) * 2.2;
    element.style.setProperty("--x", `${animal.x}px`);
    element.style.setProperty("--y", `${animal.y + bob}px`);
    element.style.setProperty("--tilt", `${tilt}deg`);
    element.classList.toggle("done", animal.done);
    element.classList.toggle("exiting", Boolean(animal.exiting));
    element.classList.toggle("spawn-in", Boolean(animal.spawnIn));

    const existingTag = element.querySelector(".animal-tag");
    if (existingTag) {
      existingTag.remove();
    }

    const tag = document.createElement("div");
    tag.className = "animal-tag";
    tag.textContent = String(animal.value);
    element.appendChild(tag);

    const currentRound = state.currentQuestion;
    const isCurrentAnswer = !state.paused && !state.roundLocked && currentRound && animal.value === currentRound.answer;
    element.classList.toggle("target", isCurrentAnswer);
  });
}

function updateAnimalPositions(delta) {
  const penRect = penElement.getBoundingClientRect();
  const maxX = penRect.width - animalSize - padding;
  const maxY = penRect.height - animalSize - padding;

  state.animals.forEach((animal) => {
    if (animal.done || animal.exiting) {
      return;
    }

    animal.phase += 0.035 * delta;
    animal.x += animal.vx * delta;
    animal.y += animal.vy * delta;

    if (animal.x <= padding || animal.x >= maxX) {
      animal.vx *= -1;
      animal.x = Math.max(padding, Math.min(animal.x, maxX));
    }

    if (animal.y <= padding || animal.y >= maxY) {
      animal.vy *= -1;
      animal.y = Math.max(padding, Math.min(animal.y, maxY));
    }
  });

  paintAnimals();
}

function animationFrame(timestamp) {
  if (lastFrameTime === 0) {
    lastFrameTime = timestamp;
  }

  const frameDelta = timestamp - lastFrameTime;
  const delta = Math.min(2.2, (timestamp - lastFrameTime) / 16.67);
  lastFrameTime = timestamp;

  if (!state.paused) {
    state.timeLeftMs = Math.max(0, state.timeLeftMs - frameDelta);
    updateAnimalPositions(delta);
    updateHud();
    if (state.timeLeftMs <= 0) {
      finishRun();
      return;
    }
    frameHandle = window.requestAnimationFrame(animationFrame);
  }
}

function startAnimation() {
  window.cancelAnimationFrame(frameHandle);
  lastFrameTime = 0;
  frameHandle = window.requestAnimationFrame(animationFrame);
}

function stopAnimation() {
  window.cancelAnimationFrame(frameHandle);
  frameHandle = 0;
}

function pulsePrompt() {
  mathPromptElement.classList.remove("bump");
  void mathPromptElement.offsetWidth;
  mathPromptElement.classList.add("bump");
  window.clearTimeout(promptBumpHandle);
  promptBumpHandle = window.setTimeout(() => {
    mathPromptElement.classList.remove("bump");
  }, 220);
}

function pulseSuccessPrompt() {
  mathPromptElement.classList.remove("success");
  void mathPromptElement.offsetWidth;
  mathPromptElement.classList.add("success");
}

function pulseTimeoutPrompt() {
  mathPromptElement.classList.remove("timeout");
  void mathPromptElement.offsetWidth;
  mathPromptElement.classList.add("timeout");
}

function celebratePen() {
  penElement.classList.remove("flash");
  gameFrameElement.classList.remove("celebrate");
  void penElement.offsetWidth;
  penElement.classList.add("flash");
  gameFrameElement.classList.add("celebrate");
  window.clearTimeout(celebrationHandle);
  celebrationHandle = window.setTimeout(() => {
    penElement.classList.remove("flash");
    gameFrameElement.classList.remove("celebrate");
  }, 360);
}

function burstAnimal(element) {
  const burst = document.createElement("div");
  burst.className = "animal-burst";
  element.appendChild(burst);
  window.setTimeout(() => burst.remove(), 520);
}

function spawnScoreFloat(element, text) {
  const float = document.createElement("div");
  float.className = "score-float";
  float.textContent = text;
  float.style.left = "50%";
  float.style.top = "8px";
  float.style.transform = "translateX(-50%)";
  element.appendChild(float);
  window.setTimeout(() => float.remove(), 760);
}

function finishRun() {
  state.paused = true;
  stopAnimation();
  state.roundLocked = true;
  state.bestScore = Math.max(state.bestScore, state.score);
  window.localStorage.setItem(bestScoreStorageKey, String(state.bestScore));
  goalElement.textContent = "0.0s";
  overlayMessage.textContent = `Score ${state.score}. Best ${state.bestScore}. Tap Play Again to try again.`;
  statusElement.textContent = `Time up. You scored ${state.score}. Best score is ${state.bestScore}.`;
  pulseTimeoutPrompt();
  overlay.classList.remove("hidden");
}

function spawnDust(element) {
  const puff = document.createElement("div");
  puff.className = "dust-puff";
  element.appendChild(puff);
  window.setTimeout(() => puff.remove(), 520);
}

function advanceRound() {
  if (state.paused) {
    return;
  }
  assignRoundValues();
  state.roundLocked = false;
  statusElement.textContent = `Correct. New round: solve ${state.currentQuestion.prompt}.`;
  pulsePrompt();
  updateHud();
  paintAnimals();
}

function handleAnimalTap(id) {
  if (state.paused || state.roundLocked || state.timeLeftMs <= 0) {
    return;
  }

  const currentRound = state.currentQuestion;
  const tappedAnimal = state.animals.find((animal) => animal.id === id);
  if (!tappedAnimal || tappedAnimal.done) {
    return;
  }

  state.taps += 1;
  const tappedElement = animalElements.get(id);
  if (tappedElement) {
    tappedElement.classList.remove("tap-pop");
    void tappedElement.offsetWidth;
    tappedElement.classList.add("tap-pop");
  }

  if (tappedAnimal.value !== currentRound.answer) {
    state.streak = 0;
    const wrongElement = animalElements.get(id);
    if (wrongElement) {
      wrongElement.classList.remove("wrong");
      void wrongElement.offsetWidth;
      wrongElement.classList.add("wrong");
    }
    statusElement.textContent = `${tappedAnimal.value} is not right. Solve ${currentRound.prompt} and tap the correct animal.`;
    updateHud();
    return;
  }

  state.score += 1;
  state.streak += 1;
  state.roundIndex += 1;
  state.roundLocked = true;
  state.tutorialDone = true;
  tutorialCallout.classList.add("hidden");
  tappedAnimal.done = true;
  tappedAnimal.exiting = true;
  if (tappedElement) {
    tappedElement.classList.remove("correct-hit");
    tappedElement.classList.remove("score-pop");
    void tappedElement.offsetWidth;
    tappedElement.classList.add("correct-hit");
    tappedElement.classList.add("score-pop");
    burstAnimal(tappedElement);
    spawnScoreFloat(tappedElement, `+1`);
    spawnDust(tappedElement);
  }
  celebratePen();
  pulseSuccessPrompt();
  updateHud();
  paintAnimals();
  window.clearTimeout(roundAdvanceHandle);
  roundAdvanceHandle = window.setTimeout(advanceRound, 520);
}

function updateHud() {
  movesElement.textContent = String(state.score);
  chargeElement.textContent = String(state.bestScore);
  goalElement.textContent = `${(state.timeLeftMs / 1000).toFixed(1)}s`;
  const currentRound = state.currentQuestion;
  if (currentRound && !state.paused) {
    mathPromptElement.textContent = `${currentRound.prompt} = ?`;
  } else {
    mathPromptElement.textContent = "Time!";
  }
}

function resetGame() {
  stopAnimation();
  window.clearTimeout(roundAdvanceHandle);
  state = createGameState();
  assignRoundValues();
  overlay.classList.add("hidden");
  state.paused = false;
  state.roundLocked = false;
  tutorialCallout.classList.remove("hidden");
  statusElement.textContent = "Solve as many moving farm math puzzles as you can in 5 seconds, then beat your best score.";
  updateHud();
  renderPen();
  startAnimation();
}

penElement.addEventListener("click", (event) => {
  const animal = event.target.closest(".animal");
  if (!animal) {
    return;
  }

  handleAnimalTap(animal.dataset.id);
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    overlay.classList.add("hidden");
    state.paused = false;
    startAnimation();
  }
});

replayButton.addEventListener("click", () => {
  overlay.classList.add("hidden");
  resetGame();
});

ctaButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.open(adTargetUrl, "_blank", "noopener,noreferrer");
  });
});

assignRoundValues();
updateHud();
renderPen();
startAnimation();
