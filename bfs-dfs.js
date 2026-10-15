const ROWS = 15;
const COLUMNS = 21;
const CELL_SIZE = 28;
const DIRECTIONS = [
  { row: -1, column: 0, wall: "top", opposite: "bottom" },
  { row: 0, column: 1, wall: "right", opposite: "left" },
  { row: 1, column: 0, wall: "bottom", opposite: "top" },
  { row: 0, column: -1, wall: "left", opposite: "right" },
];

function cellKey(row, column) {
  return `${row},${column}`;
}

function parseCellKey(key) {
  return key.split(",").map(Number);
}

function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random = Math.random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [items[index], items[otherIndex]] = [items[otherIndex], items[index]];
  }
  return items;
}

function createMaze(rows, columns, random = Math.random, extraPassageChance = 0.08) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({
      walls: { top: true, right: true, bottom: true, left: true },
      visited: false,
    })),
  );
  const stack = [[0, 0]];
  cells[0][0].visited = true;

  while (stack.length > 0) {
    const [row, column] = stack[stack.length - 1];
    const neighbors = shuffle([...DIRECTIONS], random).filter(({ row: dr, column: dc }) => {
      const nextRow = row + dr;
      const nextColumn = column + dc;
      return nextRow >= 0
        && nextRow < rows
        && nextColumn >= 0
        && nextColumn < columns
        && !cells[nextRow][nextColumn].visited;
    });

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const direction = neighbors[0];
    const nextRow = row + direction.row;
    const nextColumn = column + direction.column;
    cells[row][column].walls[direction.wall] = false;
    cells[nextRow][nextColumn].walls[direction.opposite] = false;
    cells[nextRow][nextColumn].visited = true;
    stack.push([nextRow, nextColumn]);
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (
        column < columns - 1
        && cells[row][column].walls.right
        && random() < extraPassageChance
      ) {
        cells[row][column].walls.right = false;
        cells[row][column + 1].walls.left = false;
      }
      if (
        row < rows - 1
        && cells[row][column].walls.bottom
        && random() < extraPassageChance
      ) {
        cells[row][column].walls.bottom = false;
        cells[row + 1][column].walls.top = false;
      }
    }
  }

  return cells;
}

function getNeighbors(cells, row, column) {
  return DIRECTIONS.flatMap(({ row: dr, column: dc, wall }) => {
    const nextRow = row + dr;
    const nextColumn = column + dc;
    if (
      nextRow < 0
      || nextRow >= cells.length
      || nextColumn < 0
      || nextColumn >= cells[0].length
      || cells[row][column].walls[wall]
    ) {
      return [];
    }
    return [cellKey(nextRow, nextColumn)];
  });
}

function chooseEndpoints(cells, random = Math.random) {
  const candidates = [];
  for (let row = 0; row < cells.length; row += 1) {
    for (let column = 0; column < cells[0].length; column += 1) {
      if (getNeighbors(cells, row, column).length === 1) {
        candidates.push(cellKey(row, column));
      }
    }
  }

  const endpoints = shuffle(candidates.length >= 2
    ? candidates
    : cells.flatMap((row, rowIndex) =>
      row.map((_, columnIndex) => cellKey(rowIndex, columnIndex)),
    ), random);
  return [endpoints[0], endpoints[1]];
}

function buildPath(previous, goal) {
  if (!previous.has(goal)) {
    return [];
  }

  const path = [];
  for (let current = goal; current !== null; current = previous.get(current)) {
    path.push(current);
  }
  return path.reverse();
}

function breadthFirstSearch(cells, start, goal) {
  const queue = [start];
  const previous = new Map([[start, null]]);
  const explored = [];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    explored.push(current);
    if (current === goal) {
      break;
    }

    const [row, column] = parseCellKey(current);
    for (const neighbor of getNeighbors(cells, row, column)) {
      if (!previous.has(neighbor)) {
        previous.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return { path: buildPath(previous, goal), explored };
}

function depthFirstSearch(cells, start, goal) {
  const previous = new Map([[start, null]]);
  const explored = [];

  function visit(current) {
    explored.push(current);
    if (current === goal) {
      return true;
    }

    const [row, column] = parseCellKey(current);
    for (const neighbor of getNeighbors(cells, row, column)) {
      if (!previous.has(neighbor)) {
        previous.set(neighbor, current);
        if (visit(neighbor)) {
          return true;
        }
      }
    }
    return false;
  }

  visit(start);
  return { path: buildPath(previous, goal), explored };
}

function renderMaze(svg, cells, start, goal, result, algorithm, showPlayer = false) {
  const namespace = "http://www.w3.org/2000/svg";
  const width = cells[0].length * CELL_SIZE;
  const height = cells.length * CELL_SIZE;
  const explored = new Set(result.explored);
  const path = new Set(result.path);

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const addElement = (tag, attributes, text = "") => {
    const element = document.createElementNS(namespace, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    element.textContent = text;
    svg.append(element);
  };

  addElement("rect", { x: 0, y: 0, width, height, fill: "#fff" });

  for (let row = 0; row < cells.length; row += 1) {
    for (let column = 0; column < cells[0].length; column += 1) {
      const key = cellKey(row, column);
      const x = column * CELL_SIZE;
      const y = row * CELL_SIZE;
      let fill = "#fff";
      if (explored.has(key)) {
        fill = algorithm === "CHALLENGE"
          ? "#ddd6fe"
          : algorithm === "BFS"
            ? "#b9dcff"
            : "#ffddb0";
      }
      if (path.has(key)) {
        fill = algorithm === "CHALLENGE"
          ? "#a78bfa"
          : algorithm === "BFS"
            ? "#78b8fa"
            : "#f5aa47";
      }
      if (key === start) {
        fill = "#22a06b";
      } else if (key === goal) {
        fill = "#e5484d";
      }
      addElement("rect", {
        x: x + 2,
        y: y + 2,
        width: CELL_SIZE - 4,
        height: CELL_SIZE - 4,
        rx: 3,
        fill,
        "data-cell": key,
      });
    }
  }

  const walls = [];
  for (let row = 0; row < cells.length; row += 1) {
    for (let column = 0; column < cells[0].length; column += 1) {
      const { walls: cellWalls } = cells[row][column];
      const x = column * CELL_SIZE;
      const y = row * CELL_SIZE;
      if (cellWalls.top) {
        walls.push([x, y, x + CELL_SIZE, y]);
      }
      if (cellWalls.left) {
        walls.push([x, y, x, y + CELL_SIZE]);
      }
      if (column === cells[0].length - 1 && cellWalls.right) {
        walls.push([x + CELL_SIZE, y, x + CELL_SIZE, y + CELL_SIZE]);
      }
      if (row === cells.length - 1 && cellWalls.bottom) {
        walls.push([x, y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE]);
      }
    }
  }

  for (const [x1, y1, x2, y2] of walls) {
    addElement("line", {
      x1,
      y1,
      x2,
      y2,
      stroke: "#263246",
      "stroke-width": 3,
      "stroke-linecap": "square",
    });
  }

  const [startRow, startColumn] = parseCellKey(start);
  const [goalRow, goalColumn] = parseCellKey(goal);
  addElement("text", {
    x: startColumn * CELL_SIZE + CELL_SIZE / 2,
    y: startRow * CELL_SIZE + CELL_SIZE / 2,
    fill: "#fff",
    "font-size": 11,
    "font-weight": 700,
    "text-anchor": "middle",
    "dominant-baseline": "central",
  }, "S");
  addElement("text", {
    x: goalColumn * CELL_SIZE + CELL_SIZE / 2,
    y: goalRow * CELL_SIZE + CELL_SIZE / 2,
    fill: "#fff",
    "font-size": 11,
    "font-weight": 700,
    "text-anchor": "middle",
    "dominant-baseline": "central",
  }, "G");
  if (showPlayer) {
    addElement("circle", {
      class: "player-marker",
      cx: startColumn * CELL_SIZE + CELL_SIZE / 2 + 8,
      cy: startRow * CELL_SIZE + CELL_SIZE / 2 - 8,
      r: 6,
      fill: "#7c3aed",
      stroke: "#fff",
      "stroke-width": 2,
    });
  }
}

let comparisonRunId = 0;

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function generateAndSolve() {
  const runId = ++comparisonRunId;
  const generateButton = document.querySelector("#generate");
  generateButton.disabled = true;
  const cells = createMaze(ROWS, COLUMNS);
  const [start, goal] = chooseEndpoints(cells);
  const bfsResult = breadthFirstSearch(cells, start, goal);
  const dfsResult = depthFirstSearch(cells, start, goal);

  renderMaze(document.querySelector("#bfs-map"), cells, start, goal, { explored: [], path: [] }, "BFS", true);
  renderMaze(document.querySelector("#dfs-map"), cells, start, goal, { explored: [], path: [] }, "DFS", true);
  document.querySelector("#endpoints").textContent =
    `起點（${describeCell(start)}）　→　終點（${describeCell(goal)}）`;
  document.querySelector("#message").textContent =
    "迷宮加入隨機岔路。藍／橘色淡格會逐格顯示搜尋區域，深色格是找到的路；S 是起點，G 是終點。";

  const maps = [
    {
      svg: document.querySelector("#bfs-map"),
      result: bfsResult,
      algorithm: "BFS",
      stats: document.querySelector("#bfs-stats"),
    },
    {
      svg: document.querySelector("#dfs-map"),
      result: dfsResult,
      algorithm: "DFS",
      stats: document.querySelector("#dfs-stats"),
    },
  ];
  for (const map of maps) {
    map.stats.textContent = `${map.algorithm} 搜尋中：已探索 0 格`;
  }

  const cellElements = maps.map(({ svg }) => new Map(
    [...svg.querySelectorAll("[data-cell]")].map((element) => [
      element.getAttribute("data-cell"),
      element,
    ]),
  ));
  const maxExplored = Math.max(...maps.map(({ result }) => result.explored.length));
  for (let index = 0; index < maxExplored; index += 1) {
    if (runId !== comparisonRunId) {
      return;
    }
    for (const [mapIndex, map] of maps.entries()) {
      const key = map.result.explored[index];
      if (key !== undefined) {
        if (key !== start && key !== goal) {
          cellElements[mapIndex].get(key).setAttribute(
            "fill",
            map.algorithm === "BFS" ? "#b9dcff" : "#ffddb0",
          );
        }
        map.stats.textContent = `${map.algorithm} 搜尋中：已探索 ${index + 1} 格`;
      }
    }
    await pause(5);
  }

  const maxPath = Math.max(...maps.map(({ result }) => result.path.length));
  for (let index = 0; index < maxPath; index += 1) {
    if (runId !== comparisonRunId) {
      return;
    }
    for (const [mapIndex, map] of maps.entries()) {
      const key = map.result.path[index];
      if (key === undefined) {
        continue;
      }
      if (key !== start && key !== goal) {
        cellElements[mapIndex].get(key).setAttribute(
          "fill",
          map.algorithm === "BFS" ? "#78b8fa" : "#f5aa47",
        );
      }
      const [row, column] = parseCellKey(key);
      const marker = map.svg.querySelector(".player-marker");
      marker.setAttribute("cx", column * CELL_SIZE + CELL_SIZE / 2 + 8);
      marker.setAttribute("cy", row * CELL_SIZE + CELL_SIZE / 2 - 8);
    }
    await pause(16);
  }

  if (runId === comparisonRunId) {
    for (const map of maps) {
      map.stats.textContent =
        `路徑 ${map.result.path.length - 1} 步｜探索 ${map.result.explored.length} 格`;
    }
    generateButton.disabled = false;
  }
}

document.querySelector("#generate").addEventListener("click", generateAndSolve);

let challengeState;
let challengeRunId = 0;
let pendingRankRecord = null;
let realtimeDatabaseUrl = "";
let leaderboardRecords = [];
let firebaseApiKey = "";
let authSession = null;
let authMode = "login";
let uploadDialogMode = "upload";
let challengeResultSummary = "";
let rankEligibilityCheckId = 0;

const starterCode = `function solve({ start, goal, getNeighbors }) {
  const queue = [start];
  let index = 0;
  const parent = new Map([[start, null]]);
  const explored = [];

  while (index < queue.length) {
    const current = queue[index];
    index += 1;
    explored.push(current);

    if (current === goal) {
      break;
    }

    for (const next of getNeighbors(current)) {
      if (!parent.has(next)) {
        parent.set(next, current);
        queue.push(next);
      }
    }
  }

  if (!parent.has(goal)) {
    return { path: [], explored };
  }

  const path = [];
  for (let current = goal; current !== null; current = parent.get(current)) {
    path.push(current);
  }
  path.reverse();
  return { path, explored };
}`;

function createChallenge(seedOverride) {
  challengeRunId += 1;
  pendingRankRecord = null;
  document.querySelector("#upload-score").disabled = true;
  document.querySelector("#upload-score").hidden = true;
  challengeResultSummary = "";
  const seed = seedOverride ?? Math.floor(Math.random() * 0x100000000);
  const random = createRandom(seed);
  const cells = createMaze(ROWS, COLUMNS, random);
  const [start, goal] = chooseEndpoints(cells, random);
  challengeState = { cells, start, goal, seed };

  const map = document.querySelector("#challenge-map");
  renderMaze(map, cells, start, goal, { explored: [], path: [] }, "CHALLENGE", true);
  document.querySelector("#challenge-endpoints").textContent =
    `隨機迷宮 ${ROWS} × ${COLUMNS}｜起點：${describeCell(start)}　　終點：${describeCell(goal)}`;
  document.querySelector("#challenge-api").textContent = [
    `start = "${start}"`,
    `goal = "${goal}"`,
    `getNeighbors("${start}") // ${JSON.stringify(getNeighbors(cells, ...parseCellKey(start)))}`,
    "",
    '格子 ID 格式為 "row,column"，row 和 column 從 0 開始。',
    "getNeighbors(id) 會傳回可直接走到的相鄰格子 ID。",
    `迷宮碼：${formatMazeCode(seed)}`,
    "完成後回傳 { path: [起點到終點的 ID], explored: [擴展過的 ID] }。",
  ].join("\n");
  document.querySelector("#challenge-message").textContent = "編寫算法後，按「完成並評分」。";
  document.querySelector("#submit-algorithm").disabled = false;
  document.querySelector("#challenge-result").textContent = "";
  editor.refresh();
}

function formatMazeCode(seed) {
  return `MZ-${seed.toString(16).padStart(8, "0").toUpperCase()}`;
}

function loadMazeFromCode() {
  const input = document.querySelector("#maze-code-input");
  const mazeCode = input.value.trim().toUpperCase();
  const match = /^MZ-([0-9A-F]{8})$/.exec(mazeCode);
  if (!match) {
    document.querySelector("#challenge-message").textContent =
      "迷宮碼格式錯誤，請輸入 MZ- 加上 8 位英數字（0–9、A–F）。";
    return;
  }

  input.value = mazeCode;
  createChallenge(Number.parseInt(match[1], 16));
  document.querySelector("#challenge-message").textContent =
    `已載入迷宮 ${mazeCode}。請完成算法後評分。`;
}

function describeCell(key) {
  const [row, column] = parseCellKey(key);
  return `第 ${row + 1} 列、第 ${column + 1} 欄`;
}

function createMazeApi(cells, start, goal) {
  const adjacency = {};
  for (let row = 0; row < cells.length; row += 1) {
    for (let column = 0; column < cells[0].length; column += 1) {
      const key = cellKey(row, column);
      adjacency[key] = getNeighbors(cells, row, column);
    }
  }
  return { start, goal, adjacency };
}

function runUserCode(source, apiData, timeoutMilliseconds = 5000) {
  if (source.length > 50000) {
    return Promise.reject(new Error("程式碼太長，請限制在 50,000 個字元以內。"));
  }

  const workerSource = `
    self.onmessage = ({ data }) => {
      try {
        const queried = new Set();
        const getNeighbors = (cell) => {
          if (typeof cell !== "string" || !Object.hasOwn(data.adjacency, cell)) {
            throw new Error("getNeighbors 收到無效的格子 ID。");
          }
          queried.add(cell);
          return data.adjacency[cell].slice();
        };
        const executionStartedAt = performance.now();
        const solveFunction = new Function(
          "api",
          '"use strict";\\n' + data.source +
            '\\n; if (typeof solve !== "function") throw new Error("請定義 solve({ start, goal, getNeighbors }) 函式。");' +
            '\\n; return solve(api);'
        );
        const result = solveFunction({
          start: data.start,
          goal: data.goal,
          getNeighbors
        });
        const executionMs = performance.now() - executionStartedAt;
        if (!result || typeof result !== "object") {
          throw new Error("solve 必須回傳 { path, explored }。");
        }
        const copyList = (value, name) => {
          if (!Array.isArray(value) || value.length > data.maxCells) {
            throw new Error(name + " 必須是有效的格子 ID 陣列。");
          }
          return value.map((cell) => {
            if (typeof cell !== "string" || !Object.hasOwn(data.adjacency, cell)) {
              throw new Error(name + " 含有無效的格子 ID。");
            }
            return cell;
          });
        };
        self.postMessage({
          path: copyList(result.path, "path"),
          explored: copyList(result.explored, "explored"),
          queried: [...queried],
          executionMs
        });
      } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
      }
    };
  `;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(
        "執行超過 5 秒，已停止。通常是 while/for 的停止條件沒有推進；檢查索引是否增加，或每輪是否從佇列／堆疊取出一格。",
      ));
    }, timeoutMilliseconds);

    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "程式執行失敗。"));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("程式回傳的結果無法讀取。"));
    };
    worker.postMessage({
      ...apiData,
      source,
      maxCells: Object.keys(apiData.adjacency).length,
    });
  });
}

function validateUserResult(result, apiData) {
  const { path, explored, queried } = result;
  const unique = (items) => new Set(items).size === items.length;
  if (!unique(path) || !unique(explored) || !unique(queried)) {
    throw new Error("path、explored 不能重複列出同一個格子。");
  }
  if (!path.length || path[0] !== apiData.start || path[path.length - 1] !== apiData.goal) {
    return { reached: false, path, explored };
  }

  const exploredSet = new Set(explored);
  const queriedSet = new Set(queried);
  for (const key of queriedSet) {
    if (!exploredSet.has(key)) {
      throw new Error(`呼叫過 getNeighbors 的格子 ${key} 必須列入 explored。`);
    }
  }
  for (const key of path) {
    if (!exploredSet.has(key)) {
      throw new Error(`路徑中的格子 ${key} 必須列入 explored。`);
    }
  }
  if (!exploredSet.has(apiData.goal)) {
    throw new Error("抵達終點時，請將終點列入 explored。");
  }
  if (exploredSet.size !== queriedSet.size + (queriedSet.has(apiData.goal) ? 0 : 1)) {
    throw new Error("explored 應只列出實際擴展過的格子，以及抵達的終點。");
  }

  for (let index = 0; index < path.length - 1; index += 1) {
    if (!apiData.adjacency[path[index]].includes(path[index + 1])) {
      throw new Error(`路徑在 ${path[index]} 和 ${path[index + 1]} 之間穿過了牆。`);
    }
  }
  return { reached: true, path, explored };
}

function calculateMazeDifficulty(cells, start, goal) {
  const reference = breadthFirstSearch(cells, start, goal);
  const totalCells = cells.length * cells[0].length;
  const pathFactor = Math.min(1, (reference.path.length - 1) / (totalCells * 0.22));
  const explorationFactor = Math.min(1, reference.explored.length / (totalCells * 0.75));
  const level = Math.max(
    1,
    Math.min(10, Math.round(1 + 9 * (pathFactor + explorationFactor) / 2)),
  );
  return { level, shortestSteps: reference.path.length - 1 };
}

function calculateScore(userResult, cells, start, goal, totalWaitMs) {
  const reference = breadthFirstSearch(cells, start, goal);
  const shortestSteps = reference.path.length - 1;
  const userSteps = userResult.path.length - 1;
  const routePoints = 40 * shortestSteps / userSteps;
  const totalCells = cells.length * cells[0].length;
  const minimumExplored = userResult.path.length;
  const explorationRange = totalCells - minimumExplored;
  const explorationPoints = explorationRange === 0
    ? 40
    : 40 * Math.max(
      0,
      (totalCells - userResult.explored.length) / explorationRange,
    );
  const executionEfficiencyPoints = 20 * Math.max(0, 1 - totalWaitMs / 5000);
  return {
    score: Math.max(
      1,
      Math.min(100, Math.round(routePoints + explorationPoints + executionEfficiencyPoints)),
    ),
    shortestSteps,
    routePoints,
    explorationPoints,
    executionEfficiencyPoints,
  };
}

async function submitAlgorithm() {
  if (!challengeState) {
    return;
  }

  pendingRankRecord = null;
  document.querySelector("#upload-score").disabled = true;
  document.querySelector("#upload-score").hidden = true;
  const waitStartedAt = performance.now();
  const runId = ++challengeRunId;
  const { cells, start, goal, seed } = challengeState;
  const mazeDifficulty = calculateMazeDifficulty(cells, start, goal);
  const mazeCode = `MZ-${seed.toString(16).padStart(8, "0").toUpperCase()}`;
  const apiData = createMazeApi(cells, start, goal);
  const map = document.querySelector("#challenge-map");
  const submitButton = document.querySelector("#submit-algorithm");
  const message = document.querySelector("#challenge-message");
  const resultOutput = document.querySelector("#challenge-result");
  challengeResultSummary = "";
  renderMaze(map, cells, start, goal, { explored: [], path: [] }, "CHALLENGE", true);
  submitButton.disabled = true;
  message.textContent = "正在隔離環境中執行你的算法……";
  resultOutput.textContent = "";

  try {
    const rawResult = await runUserCode(
      editor.getValue(),
      apiData,
    );
    if (runId !== challengeRunId) {
      return;
    }
    const evaluated = validateUserResult(rawResult, apiData);
    if (!evaluated.reached) {
      renderMaze(
        map,
        cells,
        start,
        goal,
        { explored: evaluated.explored, path: [] },
        "CHALLENGE",
        true,
      );
      message.textContent = "尚未抵達終點。檢查搜尋流程和 path 的回溯結果後再試一次。";
      const totalWaitMs = performance.now() - waitStartedAt;
      resultOutput.textContent =
        `迷宮難度 ${mazeDifficulty.level} / 10｜迷宮碼 ${mazeCode}｜實際等待 ${(totalWaitMs / 1000).toFixed(2)} 秒（算法執行 ${rawResult.executionMs.toFixed(2)} 毫秒）｜探索 ${evaluated.explored.length} 格｜未抵達終點，評分 1 / 100。`;
      return;
    }

    renderMaze(
      map,
      cells,
      start,
      goal,
      { explored: evaluated.explored, path: [] },
      "CHALLENGE",
      true,
    );
    const cellElements = new Map(
      [...map.querySelectorAll("[data-cell]")].map((element) => [
        element.getAttribute("data-cell"),
        element,
      ]),
    );
    const marker = map.querySelector(".player-marker");

    for (const [index, key] of evaluated.explored.entries()) {
      if (runId !== challengeRunId) {
        return;
      }
      if (key !== start && key !== goal) {
        cellElements.get(key).setAttribute("fill", "#ddd6fe");
      }
      message.textContent = `檢查結果：探索 ${index + 1} / ${evaluated.explored.length} 格`;
      await pause(4);
    }
    for (const key of evaluated.path) {
      if (runId !== challengeRunId) {
        return;
      }
      if (key !== start && key !== goal) {
        cellElements.get(key).setAttribute("fill", "#a78bfa");
      }
      const [row, column] = parseCellKey(key);
      marker.setAttribute("cx", column * CELL_SIZE + CELL_SIZE / 2 + 8);
      marker.setAttribute("cy", row * CELL_SIZE + CELL_SIZE / 2 - 8);
      await pause(20);
    }

    if (runId === challengeRunId) {
      const totalWaitMs = performance.now() - waitStartedAt;
      const score = calculateScore(evaluated, cells, start, goal, totalWaitMs);
      message.textContent = "成功抵達終點！";
      challengeResultSummary =
        `評分 ${score.score} / 100｜迷宮難度 ${mazeDifficulty.level} / 10｜迷宮碼 ${mazeCode}｜路徑 ${evaluated.path.length - 1} 步（最短 ${score.shortestSteps} 步，${score.routePoints.toFixed(1)}/40 分）｜探索 ${evaluated.explored.length} 格（${score.explorationPoints.toFixed(1)}/40 分）｜實際等待 ${(totalWaitMs / 1000).toFixed(2)} 秒（效率 ${score.executionEfficiencyPoints.toFixed(1)}/20 分；算法執行 ${rawResult.executionMs.toFixed(2)} 毫秒）`;
      resultOutput.textContent = challengeResultSummary;
      pendingRankRecord = {
        mazeCode,
        difficultyLevel: mazeDifficulty.level,
        score: score.score,
        pathSteps: evaluated.path.length - 1,
        exploredCells: evaluated.explored.length,
        totalWaitMs: Math.round(totalWaitMs),
        executionMs: Number(rawResult.executionMs.toFixed(2)),
      };
      await updatePendingRankEligibility();
      if (!realtimeDatabaseUrl) {
        resultOutput.textContent += "｜資料庫尚未連線，請透過本機伺服器載入設定後再上傳。";
      }
    }
  } catch (error) {
    if (runId === challengeRunId) {
      message.textContent = `執行失敗：${error.message}`;
    }
  } finally {
    if (runId === challengeRunId) {
      submitButton.disabled = false;
    }
  }
}

function openChallenge() {
  comparisonRunId += 1;
  document.querySelector("#generate").disabled = false;
  document.querySelector("#results").hidden = true;
  document.querySelector("#comparison-panel").hidden = true;
  document.querySelector("#challenge-panel").hidden = false;
  createChallenge();
}

function closeChallenge() {
  challengeRunId += 1;
  pendingRankRecord = null;
  document.querySelector("#upload-score").disabled = true;
  document.querySelector("#upload-score").hidden = true;
  document.querySelector("#submit-algorithm").disabled = false;
  document.querySelector("#challenge-panel").hidden = true;
  document.querySelector("#comparison-panel").hidden = false;
  document.querySelector("#results").hidden = false;
}

function getLeaderboardEntry(value) {
  if (
    !value
    || typeof value.name !== "string"
    || !/^MZ-[0-9A-F]{8}$/.test(value.mazeCode)
    || !Number.isInteger(value.score)
    || value.score < 1
    || value.score > 100
    || !Number.isInteger(value.difficultyLevel)
    || value.difficultyLevel < 1
    || value.difficultyLevel > 10
    || !Number.isInteger(value.exploredCells)
    || !Number.isInteger(value.pathSteps)
    || !Number.isFinite(value.totalWaitMs)
    || !Number.isFinite(value.executionMs)
    || !Number.isFinite(value.createdAt)
  ) {
    return null;
  }
  const name = value.name.trim();
  if (!name || Array.from(name).length > 30) {
    return null;
  }
  return { ...value, name };
}

function getUserMazeRecords(userRecords) {
  const directRecord = getLeaderboardEntry(userRecords);
  return directRecord
    ? [directRecord]
    : Object.values(userRecords ?? {}).map(getLeaderboardEntry).filter(Boolean);
}

function renderLeaderboard() {
  const body = document.querySelector("#leaderboard-records");
  const filter = document.querySelector("#leaderboard-maze-filter");
  const selectedMazeCode = filter.value;
  const mazeCodes = [...new Set(leaderboardRecords.map(({ mazeCode }) => mazeCode))].sort();
  filter.replaceChildren(new Option("所有迷宮", ""));
  for (const mazeCode of mazeCodes) {
    filter.add(new Option(mazeCode, mazeCode));
  }
  const mazeCodeOptions = document.querySelector("#maze-code-options");
  mazeCodeOptions.replaceChildren(
    ...mazeCodes.map((mazeCode) => new Option(mazeCode, mazeCode)),
  );
  if (mazeCodes.includes(selectedMazeCode)) {
    filter.value = selectedMazeCode;
  }

  const bestByPlayerAndMaze = new Map();
  for (const record of leaderboardRecords) {
    const key = `${record.userId ?? record.name}:${record.mazeCode}`;
    const current = bestByPlayerAndMaze.get(key);
    if (
      !current
      || record.score > current.score
      || (record.score === current.score && record.totalWaitMs < current.totalWaitMs)
    ) {
      bestByPlayerAndMaze.set(key, record);
    }
  }
  const filteredRecords = [...bestByPlayerAndMaze.values()].filter(({ mazeCode }) =>
    !filter.value || mazeCode === filter.value,
  );
  filteredRecords.sort((first, second) => filter.value
    ? second.score - first.score
      || first.totalWaitMs - second.totalWaitMs
      || first.exploredCells - second.exploredCells
      || second.createdAt - first.createdAt
    : second.createdAt - first.createdAt,
  );

  body.replaceChildren();
  for (const [index, record] of filteredRecords.entries()) {
    const row = document.createElement("tr");
    const cells = [
      index + 1,
      record.name,
      record.score,
      `${record.difficultyLevel} / 10`,
      record.mazeCode,
      record.exploredCells,
      record.pathSteps,
      `${(record.totalWaitMs / 1000).toFixed(2)} 秒`,
      new Date(record.createdAt).toLocaleString(),
    ];
    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }

  document.querySelector("#leaderboard-status").textContent =
    filter.value
      ? `迷宮 ${filter.value}：${filteredRecords.length} 筆紀錄（依分數、等待時間、探索格數排序）。`
      : `目前顯示所有玩家紀錄，共 ${filteredRecords.length} 筆；可用迷宮碼篩選。`;
}

async function refreshLeaderboard() {
  const status = document.querySelector("#leaderboard-status");
  const refreshButton = document.querySelector("#refresh-leaderboard");
  if (!realtimeDatabaseUrl) {
    status.textContent = "排行榜資料庫尚未連線。";
    return;
  }

  refreshButton.disabled = true;
  status.textContent = "正在載入玩家紀錄……";
  try {
    const response = await fetch(`${realtimeDatabaseUrl}/maze.json`);
    if (!response.ok) {
      throw new Error(`Firebase 讀取失敗（HTTP ${response.status}）。請檢查 Realtime Database Rules。`);
    }
    const data = await response.json();
    leaderboardRecords = data && typeof data === "object"
      ? Object.entries(data).flatMap(([uid, userRecords]) => {
        if (!userRecords || typeof userRecords !== "object") {
          return [];
        }
        return getUserMazeRecords(userRecords).map((record) => ({
          ...record,
          userId: uid,
        }));
      })
      : [];
    renderLeaderboard();
  } catch (error) {
    status.textContent = `排行榜載入失敗：${error.message}`;
  } finally {
    refreshButton.disabled = false;
  }
}

async function initializeLeaderboard() {
  const status = document.querySelector("#leaderboard-status");
  if (location.protocol === "file:") {
    status.textContent =
      "Firebase 設定檔無法從 file:// 網址載入。請使用工作目錄內的 start-local-server.bat 開啟網站。";
    return;
  }

  try {
    const response = await fetch("./config/firebaseConfig.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Firebase 設定檔讀取失敗（HTTP ${response.status}）。`);
    }
    const config = await response.json();
    const databaseUrl = new URL(config.databaseURL);
    if (databaseUrl.protocol !== "https:" || typeof config.apiKey !== "string" || !config.apiKey) {
      throw new Error("Firebase 設定需包含 HTTPS databaseURL 與 apiKey。");
    }
    realtimeDatabaseUrl = databaseUrl.href.replace(/\/+$/, "");
    firebaseApiKey = config.apiKey;
    await restoreAuthSession();
    await refreshLeaderboard();
  } catch (error) {
    status.textContent = `排行榜初始化失敗：${error.message}`;
  } finally {
    if (pendingRankRecord) {
      await updatePendingRankEligibility();
    }
  }
}

function updateAuthStatus() {
  const status = document.querySelector("#auth-status");
  const openAuthButton = document.querySelector("#open-auth");
  const changeNameButton = document.querySelector("#change-player-name");
  const signOutButton = document.querySelector("#sign-out");
  if (authSession) {
    status.textContent = `已登入：${authSession.email}`;
    openAuthButton.hidden = true;
    changeNameButton.hidden = false;
    signOutButton.hidden = false;
  } else {
    status.textContent = "尚未登入";
    openAuthButton.hidden = false;
    changeNameButton.hidden = true;
    signOutButton.hidden = true;
  }
}

function saveAuthSession(session) {
  authSession = session;
  localStorage.setItem("mazeFirebaseAuth", JSON.stringify(session));
  updateAuthStatus();
}

function clearAuthSession() {
  authSession = null;
  localStorage.removeItem("mazeFirebaseAuth");
  updateAuthStatus();
}

async function readFirebaseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorCode = data.error?.message ?? `HTTP_${response.status}`;
    throw new Error(describeFirebaseAuthError(errorCode));
  }
  return data;
}

function describeFirebaseAuthError(code) {
  const messages = {
    EMAIL_EXISTS: "這個電子郵件已註冊，請直接登入。",
    INVALID_EMAIL: "電子郵件格式不正確。",
    INVALID_PASSWORD: "密碼錯誤，或密碼長度未達 6 個字元。",
    INVALID_LOGIN_CREDENTIALS: "電子郵件或密碼錯誤。",
    EMAIL_NOT_FOUND: "找不到這個帳號，請先註冊。",
    USER_DISABLED: "此帳號已停用，請聯絡管理員。",
    WEAK_PASSWORD: "密碼至少需要 6 個字元。",
    TOO_MANY_ATTEMPTS_TRY_LATER: "嘗試次數過多，請稍後再試。",
    OPERATION_NOT_ALLOWED: "Firebase 尚未啟用 Email/Password 登入方式。",
    TOKEN_EXPIRED: "登入已過期，請重新登入。",
    INVALID_REFRESH_TOKEN: "登入已過期，請重新登入。",
  };
  return messages[code] ?? `Firebase 驗證失敗：${code}`;
}

async function restoreAuthSession() {
  const storedSession = localStorage.getItem("mazeFirebaseAuth");
  if (!storedSession) {
    updateAuthStatus();
    return;
  }

  try {
    authSession = JSON.parse(storedSession);
    if (
      typeof authSession.email !== "string"
      || typeof authSession.refreshToken !== "string"
      || typeof authSession.expiresAt !== "number"
    ) {
      throw new Error("儲存的登入資料格式錯誤。");
    }
    if (
      typeof authSession.uid !== "string"
      || !authSession.uid
      || authSession.expiresAt <= Date.now() + 60_000
    ) {
      await refreshAuthToken();
    } else {
      updateAuthStatus();
    }
  } catch (error) {
    clearAuthSession();
    document.querySelector("#leaderboard-status").textContent =
      `登入狀態已清除：${error.message}`;
  }
}

async function refreshAuthToken() {
  if (!authSession?.refreshToken || !firebaseApiKey) {
    clearAuthSession();
    throw new Error("請重新登入後再上傳。");
  }
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: authSession.refreshToken,
      }),
    },
  );
  const data = await readFirebaseResponse(response);
  saveAuthSession({
    email: authSession.email,
    uid: data.user_id,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  });
}

async function getValidAuthToken() {
  if (!authSession) {
    return null;
  }
  if (authSession.expiresAt <= Date.now() + 60_000) {
    await refreshAuthToken();
  }
  return authSession?.idToken ?? null;
}

async function authenticate(email, password, mode) {
  const operation = mode === "register" ? "signUp" : "signInWithPassword";
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(firebaseApiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await readFirebaseResponse(response);
  saveAuthSession({
    email: data.email,
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  });
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === "register";
  document.querySelector("#auth-dialog-title").textContent =
    isRegister ? "建立帳號後上傳排名" : "登入後上傳排名";
  document.querySelector("#auth-dialog-description").textContent =
    isRegister
      ? "使用電子郵件和密碼建立 Firebase 帳號。"
      : "請登入帳號；還沒有帳號的話可以直接註冊。";
  document.querySelector("#auth-password").autocomplete =
    isRegister ? "new-password" : "current-password";
  document.querySelector("#auth-password-confirm-wrap").hidden = !isRegister;
  const passwordConfirm = document.querySelector("#auth-password-confirm");
  passwordConfirm.required = isRegister;
  passwordConfirm.disabled = !isRegister;
  document.querySelector("#auth-mode-toggle").textContent =
    isRegister ? "已有帳號？登入" : "建立新帳號";
  document.querySelector("#submit-auth").textContent =
    isRegister ? "註冊並登入" : "登入";
  document.querySelector("#auth-error").textContent = "";
}

function openAuthDialog() {
  setAuthMode("login");
  document.querySelector("#auth-email").value = authSession?.email ?? "";
  document.querySelector("#auth-password").value = "";
  document.querySelector("#auth-password-confirm").value = "";
  document.querySelector("#auth-dialog").showModal();
  document.querySelector("#auth-email").focus();
}

function openUploadDialog(mode = "upload") {
  uploadDialogMode = mode;
  document.querySelector("#upload-error").textContent = "";
  document.querySelector("#upload-dialog-title").textContent =
    mode === "name" ? "更改玩家姓名" : "上傳排行榜";
  document.querySelector("#upload-form button[type='submit']").textContent =
    mode === "name" ? "儲存姓名" : "確認上傳";
  document.querySelector("#player-name").value = getSavedPlayerName();
  document.querySelector("#upload-dialog").showModal();
  document.querySelector("#player-name").focus();
}

function getSavedPlayerName() {
  if (!authSession?.uid) {
    return "";
  }
  return localStorage.getItem(`mazePlayerName:${authSession.uid}`) ?? "";
}

async function readOwnMazeRecords(uid, idToken) {
  const response = await fetch(
    `${realtimeDatabaseUrl}/maze/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) {
    throw new Error(`讀取個人排行榜失敗（HTTP ${response.status}），無法確認是否為新紀錄。`);
  }
  return getUserMazeRecords(await response.json());
}

function setRankEligibilityMessage(message) {
  document.querySelector("#challenge-result").textContent =
    `${challengeResultSummary}${message ? `｜${message}` : ""}`;
}

async function updatePendingRankEligibility() {
  const button = document.querySelector("#upload-score");
  const checkId = ++rankEligibilityCheckId;
  const checkedRecord = pendingRankRecord;
  const checkedUid = authSession?.uid;
  button.hidden = true;
  button.disabled = true;
  if (!checkedRecord || !realtimeDatabaseUrl) {
    return false;
  }
  if (!checkedUid) {
    button.hidden = false;
    button.disabled = false;
    setRankEligibilityMessage("登入後會檢查這張迷宮的個人最佳成績。");
    return true;
  }

  setRankEligibilityMessage("正在檢查這張迷宮的個人最佳成績……");
  try {
    const idToken = await getValidAuthToken();
    if (!idToken) {
      throw new Error("登入已失效，請重新登入後再檢查成績。");
    }
    const records = await readOwnMazeRecords(checkedUid, idToken);
    if (checkId !== rankEligibilityCheckId || checkedRecord !== pendingRankRecord) {
      return false;
    }
    const bestRecord = records
      .filter((record) => record.mazeCode === checkedRecord.mazeCode)
      .reduce((best, record) => !best || record.score > best.score ? record : best, null);
    if (bestRecord && checkedRecord.score <= bestRecord.score) {
      setRankEligibilityMessage(
        `你的個人最佳是 ${bestRecord.score} 分，本次 ${checkedRecord.score} 分未超越最佳成績，不提供上傳。`,
      );
      return false;
    }
    button.hidden = false;
    button.disabled = false;
    setRankEligibilityMessage(
      bestRecord
        ? `本次 ${checkedRecord.score} 分，超越個人最佳 ${bestRecord.score} 分，可以上傳。`
        : "這是你在此迷宮的第一筆紀錄，可以上傳。",
    );
    return true;
  } catch (error) {
    if (checkId === rankEligibilityCheckId) {
      setRankEligibilityMessage(`無法確認個人最佳成績：${error.message}`);
    }
    return false;
  }
}

async function uploadPendingScore(name) {
  if (!pendingRankRecord) {
    return;
  }
  const uploadButton = document.querySelector("#upload-score");
  if (!realtimeDatabaseUrl) {
    setRankEligibilityMessage("排行榜資料庫尚未連線，無法上傳。");
    uploadButton.disabled = true;
    return;
  }
  uploadButton.disabled = true;
  setRankEligibilityMessage("正在檢查成績並上傳排行榜……");
  try {
    const idToken = await getValidAuthToken();
    if (!idToken || !authSession?.uid) {
      throw new Error("請先登入再上傳排名。");
    }
    const uid = authSession.uid;
    const mazeCode = pendingRankRecord.mazeCode;
    const recordUrl =
      `${realtimeDatabaseUrl}/maze/${encodeURIComponent(uid)}/${encodeURIComponent(mazeCode)}.json?auth=${encodeURIComponent(idToken)}`;
    const existingRecords = await readOwnMazeRecords(uid, idToken);
    const bestRecord = existingRecords
      .filter((record) => record.mazeCode === mazeCode)
      .reduce((best, record) => !best || record.score > best.score ? record : best, null);
    if (bestRecord && pendingRankRecord.score <= bestRecord.score) {
      uploadButton.hidden = true;
      setRankEligibilityMessage(
        `你的個人最佳是 ${bestRecord.score} 分，本次 ${pendingRankRecord.score} 分未超越最佳成績，不提供上傳。`,
      );
      return;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const etagResponse = await fetch(recordUrl, {
        headers: { "X-Firebase-ETag": "true" },
      });
      if (!etagResponse.ok) {
        throw new Error(`讀取迷宮最佳紀錄失敗（HTTP ${etagResponse.status}）。`);
      }
      const etag = etagResponse.headers.get("ETag");
      if (!etag) {
        throw new Error("資料庫未提供紀錄版本，無法安全更新個人最佳成績。");
      }
      const currentRecord = getLeaderboardEntry(await etagResponse.json());
      if (currentRecord && pendingRankRecord.score <= currentRecord.score) {
        uploadButton.hidden = true;
        setRankEligibilityMessage(
          `你的個人最佳是 ${currentRecord.score} 分，本次 ${pendingRankRecord.score} 分未超越最佳成績，不提供上傳。`,
        );
        return;
      }
      const response = await fetch(recordUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": etag,
        },
        body: JSON.stringify({
          ...pendingRankRecord,
          name,
          createdAt: { ".sv": "timestamp" },
        }),
      });
      if (response.status === 412 && attempt === 0) {
        const latestRecords = await readOwnMazeRecords(uid, idToken);
        const latestBest = latestRecords
          .filter((record) => record.mazeCode === mazeCode)
          .reduce((best, record) => !best || record.score > best.score ? record : best, null);
        if (latestBest && pendingRankRecord.score <= latestBest.score) {
          uploadButton.hidden = true;
          setRankEligibilityMessage(
            `其他紀錄已更新為 ${latestBest.score} 分，本次 ${pendingRankRecord.score} 分未超越最佳成績，不提供上傳。`,
          );
          return;
        }
        continue;
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("登入已過期或資料庫規則未允許已登入用戶更新紀錄，請重新登入並檢查 Rules。");
        }
        throw new Error(`Firebase 寫入失敗（HTTP ${response.status}）。`);
      }
      localStorage.setItem(`mazePlayerName:${uid}`, name);
      pendingRankRecord = null;
      rankEligibilityCheckId += 1;
      uploadButton.hidden = true;
      setRankEligibilityMessage("排行榜個人最佳成績上傳成功。");
      await refreshLeaderboard();
      document.querySelector("#leaderboard-maze-filter").value = mazeCode;
      renderLeaderboard();
      return;
    }
    throw new Error("排行榜同時有其他更新，請重新評分後再試。");
  } catch (error) {
    setRankEligibilityMessage(`上傳失敗：${error.message}`);
    uploadButton.disabled = false;
  }
}

document.querySelector("#open-challenge").addEventListener("click", openChallenge);
document.querySelector("#close-challenge").addEventListener("click", closeChallenge);
document.querySelector("#new-challenge").addEventListener("click", () => createChallenge());
document.querySelector("#submit-algorithm").addEventListener("click", submitAlgorithm);
document.querySelector("#load-maze-code").addEventListener("click", loadMazeFromCode);
document.querySelector("#maze-code-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadMazeFromCode();
  }
});
document.querySelector("#refresh-leaderboard").addEventListener("click", refreshLeaderboard);
document.querySelector("#leaderboard-maze-filter").addEventListener("change", renderLeaderboard);
document.querySelector("#upload-score").addEventListener("click", () => {
  if (!pendingRankRecord) {
    return;
  }
  if (!authSession) {
    openAuthDialog();
  } else {
    updatePendingRankEligibility().then((eligible) => {
      if (!eligible) {
        return;
      }
      const savedName = getSavedPlayerName();
      if (savedName) {
        uploadPendingScore(savedName);
      } else {
        openUploadDialog();
      }
    });
  }
});
document.querySelector("#change-player-name").addEventListener("click", () => {
  if (authSession) {
    openUploadDialog("name");
  }
});
document.querySelector("#open-auth").addEventListener("click", openAuthDialog);
document.querySelector("#sign-out").addEventListener("click", () => {
  clearAuthSession();
  document.querySelector("#leaderboard-status").textContent = "已登出。";
  if (pendingRankRecord) {
    updatePendingRankEligibility();
  }
});
document.querySelector("#cancel-auth").addEventListener("click", () => {
  document.querySelector("#auth-dialog").close();
});
document.querySelector("#auth-mode-toggle").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});
document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const passwordConfirm = document.querySelector("#auth-password-confirm").value;
  const submitButton = document.querySelector("#submit-auth");
  const errorMessage = document.querySelector("#auth-error");
  if (!firebaseApiKey) {
    errorMessage.textContent = "Firebase 尚未初始化，請稍後再試。";
    return;
  }
  if (authMode === "register" && password !== passwordConfirm) {
    errorMessage.textContent = "兩次輸入的密碼不一致。";
    return;
  }
  submitButton.disabled = true;
  errorMessage.textContent = authMode === "register" ? "正在建立帳號……" : "正在登入……";
  try {
    await authenticate(email, password, authMode);
    document.querySelector("#auth-dialog").close();
    if (pendingRankRecord) {
      const eligible = await updatePendingRankEligibility();
      if (!eligible) {
        return;
      }
      const savedName = getSavedPlayerName();
      if (savedName) {
        uploadPendingScore(savedName);
      } else {
        openUploadDialog();
      }
    }
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("#cancel-upload").addEventListener("click", () => {
  document.querySelector("#upload-dialog").close();
});
document.querySelector("#upload-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const nameInput = document.querySelector("#player-name");
  const name = nameInput.value.trim();
  if (!name || Array.from(name).length > 30 || /[\u0000-\u001f\u007f]/.test(name)) {
    document.querySelector("#upload-error").textContent = "姓名請輸入 1–30 個字，且不要包含控制字元。";
    return;
  }
  document.querySelector("#upload-dialog").close();
  if (uploadDialogMode === "name") {
    if (!authSession?.uid) {
      return;
    }
    localStorage.setItem(`mazePlayerName:${authSession.uid}`, name);
    document.querySelector("#leaderboard-status").textContent = "玩家姓名已更新；之後上傳會使用新姓名。";
    return;
  }
  updatePendingRankEligibility().then((eligible) => {
    if (eligible) {
      uploadPendingScore(name);
    }
  });
});
const algorithmEditor = document.querySelector("#algorithm-code");
const codeHint = document.querySelector("#code-hint");
const completionItems = [
  { text: "frontier", displayText: "frontier — 待探索的格子；BFS 用佇列，DFS 用堆疊" },
  { text: "queue", displayText: "queue — 佇列：搭配索引，實作 BFS" },
  { text: "stack", displayText: "stack — 堆疊：搭配 push、pop，實作 DFS" },
  { text: "visited", displayText: "visited — 記錄已發現的格子，避免重複加入" },
  { text: "parent", displayText: "parent — 記錄前一格，用來回溯路徑" },
  { text: "explored", displayText: "explored — 記錄實際擴展過的格子" },
  { text: "current", displayText: "current — 目前正在處理的格子" },
  { text: "neighbors", displayText: "neighbors — 目前格子可走到的相鄰格子" },
  { text: "next", displayText: "next — 一個尚未拜訪的相鄰格子" },
  { text: "getNeighbors", displayText: "getNeighbors — 取得可直接走到的鄰居" },
  { text: "start", displayText: "start — 起點格子的 ID" },
  { text: "goal", displayText: "goal — 終點格子的 ID" },
  { text: "path", displayText: "path — 從起點到終點的格子 ID 順序" },
  { text: "function", displayText: "function — 宣告函式" },
  { text: "const", displayText: "const — 宣告不重新賦值的變數" },
  { text: "let", displayText: "let — 宣告可重新賦值的變數" },
  { text: "while", displayText: "while — 重複處理待探索的格子" },
  { text: "for", displayText: "for — 逐一檢查相鄰格子" },
  { text: "if", displayText: "if — 檢查終點或拜訪狀態" },
  { text: "return", displayText: "return — 回傳 { path, explored }" },
  { text: "push", displayText: "push — 將格子加入佇列或堆疊" },
  { text: "pop", displayText: "pop — 從堆疊取出最後加入的格子（DFS）" },
  { text: "shift", displayText: "shift — 從佇列取出最早加入的格子（BFS）" },
  { text: "Set", displayText: "Set — 儲存不重複的已拜訪格子" },
  { text: "Map", displayText: "Map — 儲存每個格子的前一格" },
];
const editor = CodeMirror.fromTextArea(algorithmEditor, {
  mode: "javascript",
  theme: "material-darker",
  lineNumbers: true,
  lineWrapping: true,
  indentUnit: 2,
  tabSize: 2,
  smartIndent: true,
  autoCloseBrackets: false,
  matchBrackets: true,
  scrollbarStyle: "native",
  extraKeys: {
    "Ctrl-Space": (cm) => CodeMirror.showHint(cm, getCompletionHints, {
      completeSingle: false,
      closeOnUnfocus: true,
    }),
    "Shift-Tab": "indentLess",
    "Enter": "newlineAndIndent",
    "Tab": (cm) => {
      if (cm.state.completionActive) {
        cm.state.completionActive.widget.pick();
      } else {
        cm.execCommand("indentMore");
      }
    },
    "Backspace": (cm) => {
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);
      const beforeCursor = line.slice(0, cursor.ch);
      if (!cm.somethingSelected() && /^[ \t]+$/.test(beforeCursor)) {
        const removeCount = beforeCursor.endsWith("\t")
          ? 1
          : beforeCursor.length % 2 || Math.min(2, beforeCursor.length);
        cm.replaceRange(
          "",
          { line: cursor.line, ch: cursor.ch - removeCount },
          cursor,
          "+delete",
        );
      } else {
        cm.execCommand("delCharBefore");
      }
    },
  },
});
editor.setValue(starterCode);

function getCodeHint(source) {
  if (!/\bfunction\s+solve\b/.test(source)) {
    return "先建立入口：function solve({ start, goal, getNeighbors }) { ... }";
  }
  const cursorIndex = editor.indexFromPos(editor.getCursor());
  const linePrefix = source.slice(0, cursorIndex).split("\n").at(-1);
  const line = linePrefix.trim();
  if (/^[ \t]+$/.test(linePrefix)) {
    return "縮排位置按 Backspace 會退回兩格；Enter 會自動沿用目前行的縮排。";
  }
  if (/\bfrontier\.(pop|shift)\s*\(/.test(line)) {
    return line.includes(".shift")
      ? "shift() 取出最早加入的格子，是 BFS 佇列的先進先出。"
      : "pop() 取出最後加入的格子，可用堆疊實作 DFS。";
  }
  if (/\bgetNeighbors\s*\(/.test(line)) {
    return "getNeighbors(current) 只會回傳沒有牆隔開、可以直接走到的格子。";
  }
  if (/\bvisited\.has\s*\(/.test(line)) {
    return "先用 visited.has(next) 檢查，再把新格子標記並加入 frontier，避免繞圈。";
  }
  if (/\bparent\.(set|get)\s*\(/.test(line)) {
    return "parent.set(next, current) 記下前一格；找到終點後用 parent.get 回溯 path。";
  }
  if (/current\s*===?\s*goal/.test(line)) {
    return "抵達 goal 時停止擴展，記得把 goal 放進 explored，再回傳 path。";
  }
  if (/\bexplored\.push\s*\(/.test(line)) {
    return "每次取出一個格子準備擴展時，把它加入 explored；不要重複加入。";
  }
  if (/\breturn\s*\{/.test(line)) {
    return "回傳 { path, explored }；path 必須由起點開始、以終點結束。";
  }
  if (/\bfrontier\b/.test(source) && /\bvisited\b/.test(source)) {
    return "接著反覆取出 frontier 中的格子，檢查是否為 goal，再加入未拜訪的鄰居。";
  }
  return "BFS 用先進先出的佇列；DFS 用後進先出的堆疊。輸入時會顯示補字，Ctrl+Space 可手動開啟建議。";
}

function getCompletionHints(cm) {
  const cursor = cm.getCursor();
  const beforeCursor = cm.getLine(cursor.line).slice(0, cursor.ch);
  const currentWord = beforeCursor.match(/[A-Za-z_$][\w$]*$/)?.[0] ?? "";
  const matches = completionItems.filter(({ text }) =>
    currentWord
      ? text.toLowerCase().startsWith(currentWord.toLowerCase())
        && text.toLowerCase() !== currentWord.toLowerCase()
      : true,
  );

  return {
    list: matches,
    from: CodeMirror.Pos(cursor.line, cursor.ch - currentWord.length),
    to: cursor,
  };
}

function updateEditorAssist() {
  codeHint.textContent = getCodeHint(editor.getValue());
}

editor.on("cursorActivity", updateEditorAssist);
editor.on("inputRead", (cm, change) => {
  updateEditorAssist();
  if (
    change.origin === "+input"
    && /[A-Za-z_$]$/.test(change.text.at(-1) ?? "")
    && !cm.state.completionActive
  ) {
    const cursor = cm.getCursor();
    const prefix = cm.getLine(cursor.line).slice(0, cursor.ch).match(/[A-Za-z_$][\w$]*$/)?.[0] ?? "";
    if (prefix.length >= 2) {
      CodeMirror.showHint(cm, getCompletionHints, { completeSingle: false, closeOnUnfocus: true });
    }
  }
});
editor.on("change", updateEditorAssist);
updateEditorAssist();
generateAndSolve();
initializeLeaderboard();
