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

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[otherIndex]] = [items[otherIndex], items[index]];
  }
  return items;
}

function createMaze(rows, columns) {
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
    const neighbors = shuffle([...DIRECTIONS]).filter(({ row: dr, column: dc }) => {
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
      if (column < columns - 1 && cells[row][column].walls.right && Math.random() < 0.08) {
        cells[row][column].walls.right = false;
        cells[row][column + 1].walls.left = false;
      }
      if (row < rows - 1 && cells[row][column].walls.bottom && Math.random() < 0.08) {
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

function chooseEndpoints(cells) {
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
    ));
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

const starterCode = `function solve({ start, goal, getNeighbors }) {
  const frontier = [start];
  const visited = new Set([start]);
  const parent = new Map([[start, null]]);
  const explored = [];

  // TODO: 自己寫搜尋流程
  // 提示：用 frontier 保存待檢查的格子。
  // 每次取出一格，把它加入 explored。
  // 用 getNeighbors(格子ID) 取得可走的相鄰格子。
  // 用 visited 避免重複加入，並用 parent 記錄如何抵達。
  // 找到 goal 後，從 parent 回溯組成 path。

  return { path: [], explored };
}`;

function createChallenge() {
  challengeRunId += 1;
  const cells = createMaze(ROWS, COLUMNS);
  const [start, goal] = chooseEndpoints(cells);
  challengeState = { cells, start, goal };

  const map = document.querySelector("#challenge-map");
  renderMaze(map, cells, start, goal, { explored: [], path: [] }, "CHALLENGE", true);
  document.querySelector("#challenge-endpoints").textContent =
    `起點：${describeCell(start)}　　終點：${describeCell(goal)}`;
  document.querySelector("#challenge-api").textContent = [
    `start = "${start}"`,
    `goal = "${goal}"`,
    `getNeighbors("${start}") // ${JSON.stringify(getNeighbors(cells, ...parseCellKey(start)))}`,
    "",
    '格子 ID 格式為 "row,column"，row 和 column 從 0 開始。',
    "getNeighbors(id) 會傳回可直接走到的相鄰格子 ID。",
    "完成後回傳 { path: [起點到終點的 ID], explored: [擴展過的 ID] }。",
  ].join("\n");
  document.querySelector("#challenge-message").textContent = "編寫算法後，按「完成並評分」。";
  document.querySelector("#challenge-result").textContent = "";
  document.querySelector("#submit-algorithm").disabled = false;
  editor.refresh();
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
    worker.postMessage({ ...apiData, source, maxCells: ROWS * COLUMNS });
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

function calculateScore(userResult, cells, start, goal, executionMs) {
  const reference = breadthFirstSearch(cells, start, goal);
  const shortestSteps = reference.path.length - 1;
  const userSteps = userResult.path.length - 1;
  const routePoints = 40 * shortestSteps / userSteps;
  const totalCells = cells.length * cells[0].length;
  const referenceExplored = reference.explored.length;
  const explorationPoints = totalCells === referenceExplored
    ? (userResult.explored.length <= referenceExplored ? 40 : 0)
    : 40 * Math.max(
      0,
      Math.min(
        1,
        (totalCells - userResult.explored.length) / (totalCells - referenceExplored),
      ),
    );
  const executionEfficiencyPoints = executionMs < 1
    ? 20
    : executionMs < 10
      ? 16
      : executionMs < 100
        ? 12
        : executionMs < 1000
          ? 8
          : 4;
  return {
    score: Math.max(
      1,
      Math.min(100, Math.round(routePoints + explorationPoints + executionEfficiencyPoints)),
    ),
    shortestSteps,
    routePoints: Math.round(routePoints),
    explorationPoints: Math.round(explorationPoints),
    executionEfficiencyPoints,
  };
}

async function submitAlgorithm() {
  if (!challengeState) {
    return;
  }

  const runId = ++challengeRunId;
  const { cells, start, goal } = challengeState;
  const apiData = createMazeApi(cells, start, goal);
  const map = document.querySelector("#challenge-map");
  const submitButton = document.querySelector("#submit-algorithm");
  const message = document.querySelector("#challenge-message");
  const resultOutput = document.querySelector("#challenge-result");
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
      resultOutput.textContent =
        `目前探索 ${evaluated.explored.length} 格｜程式執行 ${rawResult.executionMs.toFixed(2)} 毫秒｜未抵達終點，評分 1 / 100。`;
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
      const score = calculateScore(evaluated, cells, start, goal, rawResult.executionMs);
      message.textContent = "成功抵達終點！";
      resultOutput.textContent =
        `評分 ${score.score} / 100｜路徑 ${evaluated.path.length - 1} 步（最短 ${score.shortestSteps} 步，${score.routePoints}/40 分）｜探索 ${evaluated.explored.length} 格（${score.explorationPoints}/40 分）｜執行 ${rawResult.executionMs.toFixed(2)} 毫秒（執行效率 ${score.executionEfficiencyPoints}/20 分）`;
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
  document.querySelector("#submit-algorithm").disabled = false;
  document.querySelector("#challenge-panel").hidden = true;
  document.querySelector("#comparison-panel").hidden = false;
  document.querySelector("#results").hidden = false;
}

document.querySelector("#open-challenge").addEventListener("click", openChallenge);
document.querySelector("#close-challenge").addEventListener("click", closeChallenge);
document.querySelector("#new-challenge").addEventListener("click", createChallenge);
document.querySelector("#submit-algorithm").addEventListener("click", submitAlgorithm);
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
