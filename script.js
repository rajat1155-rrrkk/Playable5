const boardElement = document.getElementById("board");
const movesElement = document.getElementById("moves-count");
const chargeElement = document.getElementById("charge-count");
const statusElement = document.getElementById("status-text");
const goalElement = document.getElementById("goal-text");
const tutorialCallout = document.getElementById("tutorial-callout");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlay-message");
const replayButton = document.getElementById("replay-button");

const ctaButtons = [
  document.getElementById("top-cta"),
  document.getElementById("main-cta"),
  document.getElementById("overlay-cta"),
].filter(Boolean);

const adTargetUrl = "https://play.google.com/store";
const tutorialTarget = { row: 0, col: 2 };
const directionOrder = ["up", "right", "down", "left"];
const directionVectors = {
  up: { row: -1, col: 0, opposite: "down" },
  right: { row: 0, col: 1, opposite: "left" },
  down: { row: 1, col: 0, opposite: "up" },
  left: { row: 0, col: -1, opposite: "right" },
};

const baseTiles = [
  [
    { type: "coop", open: ["right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["left", "down"] },
    { type: "corner", open: ["right", "down"] },
    { type: "corner", open: ["left", "down"] },
  ],
  [
    { type: "corner", open: ["right", "down"] },
    { type: "straight", open: ["left", "right"] },
    { type: "straight", open: ["up", "down"] },
    { type: "corner", open: ["left", "up"] },
    { type: "straight", open: ["left", "right"] },
  ],
  [
    { type: "corner", open: ["up", "right"] },
    { type: "corner", open: ["left", "down"] },
    { type: "straight", open: ["up", "down"] },
    { type: "corner", open: ["right", "down"] },
    { type: "corner", open: ["left", "down"] },
  ],
  [
    { type: "corner", open: ["right", "down"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["up", "right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["left", "down"] },
  ],
  [
    { type: "corner", open: ["up", "right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "straight", open: ["left", "right"] },
    { type: "corner", open: ["left", "up"] },
    { type: "barn", open: ["up"] },
  ],
];

const scrambleRotations = [
  [0, 0, 3, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];

let state = createGameState();

function createGameState() {
  const board = baseTiles.map((row, rowIndex) =>
    row.map((tile, colIndex) => ({
      ...tile,
      row: rowIndex,
      col: colIndex,
      rotation: scrambleRotations[rowIndex][colIndex],
      energized: false,
    })),
  );

  return {
    board,
    moves: 0,
    charge: 3,
    solved: false,
    tutorialDone: false,
  };
}

function rotateDirections(openSides, turns) {
  return openSides.map((side) => {
    const index = directionOrder.indexOf(side);
    return directionOrder[(index + turns) % 4];
  });
}

function getOpenSides(tile) {
  return rotateDirections(tile.open, tile.rotation);
}

function renderBoard() {
  boardElement.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.board.forEach((row) => {
    row.forEach((tile) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("aria-label", `${tile.type} tile`);
      cell.dataset.row = String(tile.row);
      cell.dataset.col = String(tile.col);

      if (!state.tutorialDone && tile.row === tutorialTarget.row && tile.col === tutorialTarget.col) {
        cell.classList.add("highlight");
      }

      if (tile.energized) {
        cell.classList.add("completed");
      }

      const path = document.createElement("div");
      path.className = "cell-path";

      const openSides = getOpenSides(tile);
      const horizontal = document.createElement("div");
      horizontal.className = `segment horizontal ${openSides.includes("left") || openSides.includes("right") ? "active" : "inactive"}`;
      const vertical = document.createElement("div");
      vertical.className = `segment vertical ${openSides.includes("up") || openSides.includes("down") ? "active" : "inactive"}`;

      path.append(horizontal, vertical);
      cell.appendChild(path);

      openSides.forEach((side) => {
        const hint = document.createElement("div");
        hint.className = `direction-hint ${side}`;
        hint.textContent =
          side === "up" ? "↑" :
          side === "right" ? "→" :
          side === "down" ? "↓" : "←";
        cell.appendChild(hint);
      });

      const core = document.createElement("div");
      core.className = "core";
      if (tile.type === "coop") {
        core.classList.add("coop");
      }
      if (tile.type === "barn") {
        core.classList.add("barn");
      }
      cell.appendChild(core);

      if (tile.type === "coop" || tile.type === "barn") {
        const label = document.createElement("div");
        label.className = `cell-label ${tile.type}`;
        label.textContent = tile.type === "coop" ? "Coop" : "Barn";
        cell.appendChild(label);
      }

      fragment.appendChild(cell);
    });
  });

  boardElement.appendChild(fragment);
}

function rotateTile(row, col) {
  if (state.solved) {
    return;
  }

  const tile = state.board[row][col];
  tile.rotation = (tile.rotation + 1) % 4;
  state.moves += 1;
  state.charge = Math.max(1, 3 - state.moves);

  if (row === tutorialTarget.row && col === tutorialTarget.col) {
    state.tutorialDone = true;
    tutorialCallout.classList.add("hidden");
    statusElement.textContent = "Nice. The chicks can now run from the coop to the barn.";
  }

  updateConnectivity();
  updateHud();
  renderBoard();
}

function updateConnectivity() {
  const visited = new Set();
  const queue = [];
  const source = state.board[0][0];

  queue.push(source);
  visited.add(keyFor(source.row, source.col));

  state.board.flat().forEach((tile) => {
    tile.energized = false;
  });

  while (queue.length > 0) {
    const tile = queue.shift();
    tile.energized = true;
    const openSides = getOpenSides(tile);

    openSides.forEach((side) => {
      const vector = directionVectors[side];
      const nextRow = tile.row + vector.row;
      const nextCol = tile.col + vector.col;
      const nextTile = state.board[nextRow]?.[nextCol];

      if (!nextTile) {
        return;
      }

      if (!getOpenSides(nextTile).includes(vector.opposite)) {
        return;
      }

      const key = keyFor(nextRow, nextCol);
      if (visited.has(key)) {
        return;
      }

      visited.add(key);
      queue.push(nextTile);
    });
  }

  const solved = state.board[4][4].energized;

  if (solved && !state.solved) {
    state.solved = true;
    state.charge = 3;
    goalElement.textContent = "Flock delivered";
    statusElement.textContent = "Perfect. The chicks made it to the barn.";
    overlayMessage.textContent = `Solved in ${state.moves} move${state.moves === 1 ? "" : "s"}. Fast, satisfying, and easy to understand.`;
    window.setTimeout(() => overlay.classList.remove("hidden"), 500);
    return;
  }

  if (!state.solved) {
    goalElement.textContent = "Connect coop to barn";
    if (!state.tutorialDone) {
      statusElement.textContent = "Turn the gold path tile so the flock can reach the barn.";
    } else {
      const energizedCount = state.board.flat().filter((tile) => tile.energized).length;
      statusElement.textContent = `${energizedCount} path tile${energizedCount === 1 ? "" : "s"} connected. Keep the route going.`;
    }
  }
}

function updateHud() {
  movesElement.textContent = String(state.moves);
  chargeElement.textContent = `${state.charge}`;
}

function keyFor(row, col) {
  return `${row}-${col}`;
}

function resetGame() {
  state = createGameState();
  overlay.classList.add("hidden");
  tutorialCallout.classList.remove("hidden");
  goalElement.textContent = "Connect coop to barn";
  statusElement.textContent = "Make a path from the coop to the barn and watch the whole route glow.";
  updateConnectivity();
  updateHud();
  renderBoard();
}

replayButton.addEventListener("click", resetGame);

boardElement.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || state.solved) {
    return;
  }

  rotateTile(Number(cell.dataset.row), Number(cell.dataset.col));
});

ctaButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.open(adTargetUrl, "_blank", "noopener,noreferrer");
  });
});

updateConnectivity();
updateHud();
renderBoard();
