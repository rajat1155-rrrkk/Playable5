const penElement = document.getElementById("pen");
const movesElement = document.getElementById("moves-count");
const chargeElement = document.getElementById("charge-count");
const statusElement = document.getElementById("status-text");
const goalElement = document.getElementById("goal-text");
const tutorialCallout = document.getElementById("tutorial-callout");
const mathPromptElement = document.getElementById("math-prompt");
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

const mathRounds = [
  { prompt: "2 + 3", answer: 5 },
  { prompt: "6 - 2", answer: 4 },
  { prompt: "3 + 4", answer: 7 },
];

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

function createGameState() {
  return {
    animals: animalDefinitions.map((animal, index) => ({
      ...animal,
      done: false,
      phase: index * 0.9,
    })),
    roundIndex: 0,
    taps: 0,
    stars: 3,
    solved: false,
    tutorialDone: false,
  };
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

    const existingTag = element.querySelector(".animal-tag");
    if (existingTag) {
      existingTag.remove();
    }

    const tag = document.createElement("div");
    tag.className = "animal-tag";
    tag.textContent = String(animal.value);
    element.appendChild(tag);

    const currentRound = mathRounds[state.roundIndex];
    const isCurrentAnswer = !state.solved && currentRound && animal.value === currentRound.answer;
    element.classList.toggle("target", isCurrentAnswer);
  });
}

function updateAnimalPositions(delta) {
  const penRect = penElement.getBoundingClientRect();
  const maxX = penRect.width - animalSize - padding;
  const maxY = penRect.height - animalSize - padding;

  state.animals.forEach((animal) => {
    if (animal.done) {
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

  const delta = Math.min(2.2, (timestamp - lastFrameTime) / 16.67);
  lastFrameTime = timestamp;

  if (!state.solved) {
    updateAnimalPositions(delta);
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

function burstAnimal(element) {
  const burst = document.createElement("div");
  burst.className = "animal-burst";
  element.appendChild(burst);
  window.setTimeout(() => burst.remove(), 520);
}

function handleAnimalTap(id) {
  if (state.solved) {
    return;
  }

  const currentRound = mathRounds[state.roundIndex];
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
    state.stars = Math.max(1, state.stars - 1);
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

  tappedAnimal.done = true;
  state.roundIndex += 1;
  state.tutorialDone = true;
  tutorialCallout.classList.add("hidden");
  if (tappedElement) {
    tappedElement.classList.remove("correct-hit");
    void tappedElement.offsetWidth;
    tappedElement.classList.add("correct-hit");
    burstAnimal(tappedElement);
  }

  if (state.roundIndex >= mathRounds.length) {
    state.solved = true;
    state.stars = 3;
    goalElement.textContent = "Math solved";
    statusElement.textContent = "Perfect. You solved every farm sum.";
    overlayMessage.textContent = `Solved in ${state.taps} tap${state.taps === 1 ? "" : "s"}. Quick, readable, and satisfying.`;
    updateHud();
    paintAnimals();
    stopAnimation();
    window.setTimeout(() => overlay.classList.remove("hidden"), 420);
    return;
  }

  const nextRound = mathRounds[state.roundIndex];
  statusElement.textContent = `Correct. Now solve ${nextRound.prompt}.`;
  pulsePrompt();
  updateHud();
  paintAnimals();
}

function updateHud() {
  movesElement.textContent = String(state.taps);
  chargeElement.textContent = String(state.stars);
  const currentRound = mathRounds[Math.min(state.roundIndex, mathRounds.length - 1)];
  if (currentRound && !state.solved) {
    mathPromptElement.textContent = `${currentRound.prompt} = ?`;
  } else {
    mathPromptElement.textContent = "Solved";
  }
}

function resetGame() {
  stopAnimation();
  state = createGameState();
  overlay.classList.add("hidden");
  tutorialCallout.classList.remove("hidden");
  goalElement.textContent = "Solve 3 sums";
  statusElement.textContent = "Each animal carries a number. Solve the sum, then tap the correct answer while they move.";
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

replayButton.addEventListener("click", resetGame);

ctaButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.open(adTargetUrl, "_blank", "noopener,noreferrer");
  });
});

updateHud();
renderPen();
startAnimation();
