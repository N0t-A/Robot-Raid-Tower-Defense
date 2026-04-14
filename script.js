 const startScreen = document.getElementById("startScreen");
const startGameBtn = document.getElementById("startGameBtn");

document.getElementById("saveBtn").onclick = () => {
  saveGame();
};
const GAME_WIDTH = 850;
const GAME_HEIGHT = 650;

const game = document.getElementById("game");

function resizeGame() {
  const scaleX = window.innerWidth / GAME_WIDTH;
  const scaleY = window.innerHeight / GAME_HEIGHT;

  game.style.transform = `scale(${scaleX}, ${scaleY})`;
  game.style.transformOrigin = "top left";

  game.style.position = "absolute";
  game.style.left = "0px";
  game.style.top = "0px";
}

window.addEventListener("resize", resizeGame);
resizeGame();

// Create or reference a hidden file input
let hiddenInput = document.getElementById("hiddenLoadInput");
if (!hiddenInput) {
  hiddenInput = document.createElement("input");
  hiddenInput.type = "file";
  hiddenInput.accept = ".txt"; // only JSON files
  hiddenInput.style.display = "none";
  hiddenInput.id = "hiddenLoadInput";
  document.body.appendChild(hiddenInput);
}

document.getElementById("loadBtn").onclick = () => {
  hiddenInput.click(); // just trigger the hidden input
};

hiddenInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    loadGame(event.target.result); // pass Base64 string directly
  };
  reader.readAsText(file);

  // Reset input so same file can be selected again later
  e.target.value = "";
});

let gameStarted = false;

function resetGame() {
  // Reset base FIRST (before anything that could trigger game over)
baseStats.health = baseStats.maxHealth;
updateBaseHealthDisplay();
paused = false;

  // Remove towers from DOM
  towers.forEach(t => t.element.remove());
  towers.length = 0;

  // Remove enemies from DOM
  enemies.forEach(e => e.element.remove());
  enemies.length = 0;

  // Remove bullets from DOM
  bullets.forEach(b => b.element.remove());
  bullets.length = 0;

  // Reset resources
  metal = 50;
  energy = 50;
  core = 0;

  // Reset wave state
  currentWaveIndex = 0;
  waveSpawning = false;
  enemiesToSpawn = [];
  spawnTimer = 0;
  countdownActive = false;
  waveCountdown = 10;

  // Reset UI
  updateResourceDisplay();

  // Restart loop
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  gameOverScreen.style.display = "none";
}

function saveGame() {
  const saveData = {
    metal,
    energy,
    core,
    baseStats,
    currentWaveIndex,
    waveSpawning,
    enemiesToSpawn,
    spawnTimer,
    countdownActive,
    waveCountdown,
    towers: towers.map(t => ({
      x: t.x,
      y: t.y,
      typeKey: t.typeKey,
      range: t.range,
      damage: t.damage,
      fireRate: t.fireRate,
      rangeLevel: t.rangeLevel,
      damageLevel: t.damageLevel,
      fireRateLevel: t.fireRateLevel,
      spent: t.spent
    })),
    enemies: enemies.map(e => ({
      x: e.x,
      y: e.y,
      health: e.health,
      typeKey: e.typeKey,
      speed: e.speed,
      damage: e.damage,
      rewardCore: e.rewardCore
    }))
  };

  // Convert the object to a JSON string
  const base64Str = btoa(JSON.stringify(saveData)); // simpler, no escape/unescape

  // Create a downloadable blob
  const blob = new Blob([base64Str], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  // Trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = "robotRaidSave.txt"; // use .txt or .save
  a.click();

  // Cleanup
  URL.revokeObjectURL(url);
  alert("Game save downloaded!");
}

function loadGame(base64Str) {
  try {
    // Decode Base64 back to JSON string
    const jsonStr = atob(base64Str);

// Parse JSON
const saveData = JSON.parse(jsonStr);

      // =====================
      // RESTORE RESOURCES
      // =====================
      metal = saveData.metal;
      energy = saveData.energy;
      core = saveData.core;
      updateResourceDisplay();

      // =====================
      // RESTORE BASE STATS
      // =====================
      baseStats = saveData.baseStats;
      updateBaseHealthDisplay();

      // =====================
      // RESTORE TOWERS
      // =====================
      towers.forEach(t => t.element.remove());
      towers.length = 0;

      saveData.towers.forEach(tData => {
        selectedTowerType = tData.typeKey;

        const el = document.createElement("div");
        el.classList.add("tower", tData.typeKey);
        el.style.left = tData.x + "px";
        el.style.top = tData.y + "px";
        el.style.zIndex = 2;

        const gun = document.createElement("div");
        gun.classList.add("gun");
        el.appendChild(gun);
        game.appendChild(el);

        const tower = {
          x: tData.x,
          y: tData.y,
          typeKey: tData.typeKey,
          name: towerTypes[tData.typeKey].name,
          range: tData.range,
          fireRate: tData.fireRate,
          damage: tData.damage,
          rangeLevel: tData.rangeLevel,
          damageLevel: tData.damageLevel,
          fireRateLevel: tData.fireRateLevel,
          element: el,
          lastShot: 0,
          spent: tData.spent,
          rotation: 0,
          target: null,
          barrel: gun
        };

        towers.push(tower);
        setupTowerInteractions(tower);
      });

      // =====================
      // RESTORE ENEMIES
      // =====================
      enemies.forEach(e => e.element.remove());
      enemies.length = 0;

      saveData.enemies.forEach(eData => {
        const enemyEl = document.createElement("div");
        enemyEl.classList.add("enemy", eData.typeKey);
        enemyEl.style.position = "absolute";
        enemyEl.style.left = eData.x + "px";
        enemyEl.style.top = eData.y + "px";
        const type = enemyTypes[eData.typeKey];
        enemyEl.style.width = type.size + "px";
        enemyEl.style.height = type.size + "px";
        enemyEl.style.zIndex = 1;
        game.appendChild(enemyEl);

        enemies.push({
          x: eData.x,
          y: eData.y,
          health: eData.health,
          typeKey: eData.typeKey,
          speed: eData.speed,
          damage: eData.damage,
          rewardCore: eData.rewardCore,
          element: enemyEl,
          target: null,
          pathIndex: eData.pathIndex || 0
        });
      });

      // =====================
      // RESTORE WAVE STATE
      // =====================
      currentWaveIndex = saveData.currentWaveIndex;
      waveSpawning = saveData.waveSpawning;
      enemiesToSpawn = saveData.enemiesToSpawn;
      spawnTimer = saveData.spawnTimer;
      countdownActive = saveData.countdownActive;
      waveCountdown = saveData.waveCountdown;

      if (gameStarted) { // only start loop if game was running
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
      }

      alert("Game Loaded!");
    } catch (err) {
      alert("Invalid save file! Could not load game.");
      console.error(err);
    }
  // At the end of loadGame
if (!gameStarted) {
    lastTime = performance.now();
    gameStarted = true;  // mark the game as started
    paused = false;      // ensure the game loop runs
    requestAnimationFrame(gameLoop);
}
  };

// Optional: buttons to trigger
const saveBtn = document.createElement("button");
saveBtn.innerText = "Save Game";
saveBtn.onclick = saveGame;
document.body.appendChild(saveBtn);

const loadBtn = document.createElement("button");
loadBtn.innerText = "Load Game";
loadBtn.onclick = loadGame;
document.body.appendChild(loadBtn);

const gameOverScreen = document.getElementById("gameOverScreen");
const restartGameBtn = document.getElementById("restartGameBtn");

function checkGameOver() {
  if(baseStats.health <= 0) {
    paused = true;
    gameOverScreen.style.display = "flex";
  }
}

restartGameBtn.addEventListener("click", () => {
  resetGame(); 
 gameOverScreen.style.display = "none";
});

startGameBtn.addEventListener("click", () => {
  startScreen.style.display = "none";
  lastTime = performance.now();
  gameStarted = true; // ✅ mark the game as started
  paused = false;     // ✅ ensure game is not paused
  requestAnimationFrame(gameLoop);
});

// ==========================
// GLOBAL STATE
// ==========================

const gridSize = 50;
const towers = [];
const enemies = [];
const bullets = [];

const baseElement = document.getElementById("base");

let metal = 50;
let energy = 50;
let core = 0;

let selectedTowerType = "basic";
let selectedTowerForUI = null;

let hoveringTower = false;
let hoveringUI = false;
let hoveringBaseElement = false;
let hoveringBaseUI = false;

let paused = false;

// ==========================
// TOWER TYPES
// ==========================

const towerTypes = {
  basic: { name: "Basic Tower", range: 150, fireRate: 2000, damage: 10, cost: { metal: 10, energy: 5 } },
  sniper: { name: "Sniper Tower", range: 300, fireRate: 4000, damage: 20, cost: { metal: 15, energy: 10 } },
  fast: { name: "Fast Tower", range: 75, fireRate: 800, damage: 5, cost: { metal: 20, energy: 15 } }
};

// ==========================
// BASE STATS
// ==========================

const baseStats = {
  generationLevel: 1,
  generationInterval: 2000,
  maxHealth: 100,
  health: 100,
  healthLevel: 1 // <-- added for Max Health upgrades
};

// ==========================
// RESOURCE DISPLAY
// ==========================

function updateResourceDisplay() {
  document.getElementById("metalAmount").innerText = metal;
  document.getElementById("energyAmount").innerText = energy;
  document.getElementById("coreAmount").innerText = core;
  
  if (selectedTowerForUI) refreshTowerUIButtons();
  refreshBaseUIButtons();
}
updateResourceDisplay();

// ==========================
// BASE HEALTH DISPLAY
// ==========================

const baseHealthFraction = document.getElementById("baseHealthFraction");

function updateBaseHealthDisplay() {
  baseHealthFraction.innerText = `${baseStats.health}/${baseStats.maxHealth}`;
}

function damageBase(amount) {
  baseStats.health = Math.max(0, baseStats.health - amount);
  updateBaseHealthDisplay();
}

function repairBase(amount) {
  baseStats.health = Math.min(baseStats.maxHealth, baseStats.health + amount);
  updateBaseHealthDisplay();
}

function increaseBaseMaxHealth(amount) {
  baseStats.maxHealth += amount;
  baseStats.health += amount;
  updateBaseHealthDisplay();
}

updateBaseHealthDisplay();

// ==========================
// SMART UI POSITIONING
// ==========================

function positionUIPanel(uiElement, anchorElement) {
  const gameRect = game.getBoundingClientRect();
  const anchorRect = anchorElement.getBoundingClientRect();

  const scaleX = gameRect.width / GAME_WIDTH;
  const scaleY = gameRect.height / GAME_HEIGHT;

  const uiWidth = uiElement.offsetWidth;
  const uiHeight = uiElement.offsetHeight;

  // convert anchor position into GAME SPACE
  const left = (anchorRect.right - gameRect.left) / scaleX + 10;
  const top = (anchorRect.top - gameRect.top) / scaleY;

  let finalLeft = left;
  let finalTop = top;

  // bounds check (in GAME SPACE)
  const maxX = GAME_WIDTH - uiWidth;
  const maxY = GAME_HEIGHT - uiHeight;

  if (finalLeft + uiWidth > GAME_WIDTH) {
    finalLeft = (anchorRect.left - gameRect.left) / scaleX - uiWidth - 10;
  }

  if (finalLeft < 10) finalLeft = 10;
  if (finalTop < 10) finalTop = 10;
  if (finalTop > maxY) finalTop = maxY;

  uiElement.style.left = finalLeft + "px";
  uiElement.style.top = finalTop + "px";
}

// ==========================
// KEYBINDS
// ==========================

window.addEventListener("keydown", e => {
  if (e.key === "1") selectedTowerType = "basic";
  if (e.key === "2") selectedTowerType = "sniper";
  if (e.key === "3") selectedTowerType = "fast";
  updateTowerSelectionUI();
});

const placementOverlay = document.getElementById("placementRangeOverlay");

game.addEventListener("mousemove", (e) => {
  const rect = game.getBoundingClientRect();

  const scaleX = rect.width / GAME_WIDTH;
  const scaleY = rect.height / GAME_HEIGHT;

  const mouseX = (e.clientX - rect.left) / scaleX;
  const mouseY = (e.clientY - rect.top) / scaleY;

  placementOverlay.style.left = mouseX + "px";
  placementOverlay.style.top = mouseY + "px";

  const type = towerTypes[selectedTowerType];

  if (type) {
    placementOverlay.style.width = type.range * 2 + "px";
    placementOverlay.style.height = type.range * 2 + "px";
    placementOverlay.style.display = "block";
  } else {
    placementOverlay.style.display = "none";
  }
});

// ==========================
// PLACE TOWER
// ==========================

game.addEventListener("click", event => {
  // BLOCK UI CLICKS FROM PLACING TOWERS
  if (event.target.closest("button") || event.target.closest("#startScreen")) return;

  if (
    event.target.closest(".tower") ||
    event.target.closest("#base") ||
    event.target.closest(".enemy")
  ) return;

  const rect = game.getBoundingClientRect();

  const scaleX = rect.width / GAME_WIDTH;
  const scaleY = rect.height / GAME_HEIGHT;

  const x = (event.clientX - rect.left) / scaleX;
  const y = (event.clientY - rect.top) / scaleY;

  const gridX = Math.floor(x / gridSize) * gridSize;
  const gridY = Math.floor(y / gridSize) * gridSize;

  const rowIndex = Math.floor(gridY / gridSize);
  if (rowIndex === 6) return;

  placeTower(gridX, gridY);
});

function placeTower(x, y) {
  const towerExists = towers.some(t => t.x === x && t.y === y);
  if (towerExists) return;

  const type = towerTypes[selectedTowerType];
  if (metal < type.cost.metal || energy < type.cost.energy) return;

  metal -= type.cost.metal;
  energy -= type.cost.energy;
  updateResourceDisplay();

  const el = document.createElement("div");

  el.classList.add("tower");
  el.classList.add(selectedTowerType); 
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.zIndex = 2;

  const gun = document.createElement("div");
  gun.classList.add("gun");
  el.appendChild(gun);

  game.appendChild(el);

  const tower = {
  x, y,
  name: type.name,
  range: type.range,
  fireRate: type.fireRate,
  damage: type.damage,
  rangeLevel: 1,
  fireRateLevel: 1,
  damageLevel: 1,
  element: el,
  lastShot: 0,
  typeKey: selectedTowerType,
  spent: { metal: type.cost.metal, energy: type.cost.energy, core: 0 },

  // NEW for dynamic rotation
  rotation: 0,   // current angle in degrees
  target: null,  // enemy it is tracking
  barrel: gun    // reference to the gun element
};

  towers.push(tower);
  setupTowerInteractions(tower);
}

// ==========================
// TOWER INTERACTIONS
// ==========================

function setupTowerInteractions(tower) {
  const rangeCircle = document.createElement("div");
  rangeCircle.classList.add("range-indicator");
  rangeCircle.style.display = "none";
  game.appendChild(rangeCircle);

  tower.element.addEventListener("mouseenter", () => {
    if (selectedTowerForUI === tower) return;
    hoveringTower = true;
    rangeCircle.style.width = tower.range * 2 + "px";
    rangeCircle.style.height = tower.range * 2 + "px";
    rangeCircle.style.left = (tower.x + 25 - tower.range) + "px";
    rangeCircle.style.top = (tower.y + 25 - tower.range) + "px";
    rangeCircle.style.display = "block";
    showTowerUI(tower);
  });

  tower.element.addEventListener("mouseleave", () => {
    hoveringTower = false;
    rangeCircle.style.display = "none";
    setTimeout(checkHideTowerUI, 50);
  });
}

// ==========================
// TOWER UI
const towerUIElement = document.getElementById("towerUI");
towerUIElement.addEventListener("mouseenter", () => hoveringUI = true);
towerUIElement.addEventListener("mouseleave", () => { hoveringUI = false; setTimeout(checkHideTowerUI, 50); });

let towerUIRefreshInterval = null; // dynamic refresh interval

function showTowerUI(tower) {
  selectedTowerForUI = tower;
  towerUIElement.style.display = "block";
  positionUIPanel(towerUIElement, tower.element);
  document.getElementById("towerName").innerText = tower.name;
  generateTowerUpgradeUI();

  // Start dynamic refresh
  if (towerUIRefreshInterval) clearInterval(towerUIRefreshInterval);
  towerUIRefreshInterval = setInterval(() => {
    if (towerUIElement.style.display === "block") {
      refreshTowerUIButtons();
    } else {
      clearInterval(towerUIRefreshInterval);
      towerUIRefreshInterval = null;
    }
  }, 100); // refresh every 100ms
}

function checkHideTowerUI() {
  if (!hoveringTower && !hoveringUI) {
    towerUIElement.style.display = "none";
    selectedTowerForUI = null;

    // Stop dynamic refresh
    if (towerUIRefreshInterval) {
      clearInterval(towerUIRefreshInterval);
      towerUIRefreshInterval = null;
    }
  }
}

// ==========================
// TOWER UPGRADES
function generateTowerUpgradeUI() {
  const container = document.getElementById("towerUpgrades");
  container.innerHTML = "";
  const tower = selectedTowerForUI;
  if (!tower) return;

  const maxCaps = {
    basic:   { range: 6, fireRateSPS: 2, damage: 25 },
    sniper:  { range: 8, fireRateSPS: 1, damage: 100 },
    fast:    { range: 4, fireRateSPS: 4, damage: 50 }
  };

  const caps = maxCaps[tower.typeKey];
  const currentRangeTiles = Math.round(tower.range / gridSize);
  const maxRangePixels = caps.range * gridSize;

  const upgrades = [

    {
      label: "Range",
      cost: tower.rangeLevel * 10,
      currency: "metal",
      increase: gridSize,
      getCurrent: () => Math.round(tower.range / gridSize),
      action: () => {
        tower.range = Math.min(tower.range + gridSize, maxRangePixels);
        tower.rangeLevel++;
      }
    },

    {
      label: "Fire Rate",
      cost: tower.fireRateLevel * 10,
      currency: "energy",
      increase: 0.9,
      getCurrent: () => parseFloat((1000 / tower.fireRate).toFixed(2)),
      action: () => {
        const nextRate = tower.fireRate * 0.9;
        const minInterval = 1000 / caps.fireRateSPS;
        tower.fireRate = Math.max(nextRate, minInterval);
        tower.fireRateLevel++;
      }
    },

    {
      label: "Damage",
      cost: tower.damageLevel * 5,
      currency: "core",
      increase: 5,
      getCurrent: () => tower.damage,
      action: () => {
        tower.damage = Math.min(tower.damage + 5, caps.damage);
        tower.damageLevel++;
      }
    }
  ];

  upgrades.forEach(up => {

    const btn = document.createElement("button");

    // ⭐ STORE UPGRADE DATA FOR LIVE REFRESH
    btn._upgradeData = up;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      if (up.currency === "metal") {
        metal -= up.cost;
        tower.spent.metal += up.cost;
      }
      if (up.currency === "energy") {
        energy -= up.cost;
        tower.spent.energy += up.cost;
      }
      if (up.currency === "core") {
        core -= up.cost;
        tower.spent.core += up.cost;
      }

      up.action();
      updateResourceDisplay();
      generateTowerUpgradeUI();
    });

    container.appendChild(btn);
  });

  // ================= SELL BUTTON =================
  const sellBtn = document.createElement("button");
  sellBtn.innerText = "Sell";
  sellBtn.classList.add("sell-btn"); // ⭐ IMPORTANT
  sellBtn.style.backgroundColor = "red";
  sellBtn.style.color = "black";
  sellBtn.style.fontWeight = "bold";

  sellBtn.addEventListener("click", () => {
    const refundMetal = Math.floor(tower.spent.metal * 0.85);
    const refundEnergy = Math.floor(tower.spent.energy * 0.85);
    const refundCore = Math.floor(tower.spent.core * 0.85);

    metal += refundMetal;
    energy += refundEnergy;
    core += refundCore;

    tower.element.remove();
    towers.splice(towers.indexOf(tower), 1);

    updateResourceDisplay();
    checkHideTowerUI();
  });

  container.appendChild(sellBtn);

  // Initial button state setup
  refreshTowerUIButtons();
}

// ==========================
// REFRESH TOWER BUTTONS
function refreshTowerUIButtons() {
  const tower = selectedTowerForUI;
  if (!tower) return;

  const container = document.getElementById("towerUpgrades");
  const buttons = container.querySelectorAll("button");

  const maxCaps = {
    basic:   { range: 6, fireRateSPS: 2, damage: 25 },
    sniper:  { range: 8, fireRateSPS: 1, damage: 100 },
    fast:    { range: 4, fireRateSPS: 4, damage: 50 }
  };

  const caps = maxCaps[tower.typeKey];

  buttons.forEach(btn => {

    // ================= SELL BUTTON =================
    if (btn.classList.contains("sell-btn")) {
      btn.disabled = false;
      return;
    }

    const up = btn._upgradeData;
    if (!up) return;

    let atMax = false;
    let displayText = "";

    // ================= RANGE =================
    if (up.label === "Range") {

      const currentTiles = Math.round(tower.range / gridSize);
      const nextTiles = currentTiles + 1;

      atMax = currentTiles >= caps.range;

      if (atMax) {
        displayText = `Range: ${currentTiles} (MAX)`;
      } else {
        displayText =
          `Range: ${currentTiles} → ${Math.min(nextTiles, caps.range)} tiles ` +
          `(Cost: ${up.cost} ${up.currency})`;
      }
    }

    // ================= FIRE RATE =================
    else if (up.label === "Fire Rate") {

      const currentSPS = parseFloat((1000 / tower.fireRate).toFixed(2));
      const nextInterval = tower.fireRate * 0.9;
      const minInterval = 1000 / caps.fireRateSPS;
      const nextSPS = parseFloat((1000 / Math.max(nextInterval, minInterval)).toFixed(2));

      atMax = currentSPS >= caps.fireRateSPS;

      if (atMax) {
        displayText = `Fire Rate: ${currentSPS} shots/sec (MAX)`;
      } else {
        displayText =
          `Fire Rate: ${currentSPS} → ${nextSPS} shots/sec ` +
          `(Cost: ${up.cost} ${up.currency})`;
      }
    }

    // ================= DAMAGE =================
    else if (up.label === "Damage") {

      const nextDamage = tower.damage + 5;

      atMax = tower.damage >= caps.damage;

      if (atMax) {
        displayText = `Damage: ${tower.damage} (MAX)`;
      } else {
        displayText =
          `Damage: ${tower.damage} → ${Math.min(nextDamage, caps.damage)} ` +
          `(Cost: ${up.cost} ${up.currency})`;
      }
    }

    btn.innerText = displayText;

    const canAfford =
      (up.currency === "metal" && metal >= up.cost) ||
      (up.currency === "energy" && energy >= up.cost) ||
      (up.currency === "core" && core >= up.cost);

    btn.disabled = atMax || !canAfford;

    btn.style.backgroundColor =
      (!atMax && canAfford) ? "#4CAF50" : "#aaa";

    btn.style.color = atMax ? "#444" : "#000";
  });
}

// ==========================
// BASE UI
const baseUIElement = document.getElementById("baseUI");

baseElement.addEventListener("mouseenter", () => { 
  hoveringBaseElement = true; 
  showBaseUI(); 
});
baseElement.addEventListener("mouseleave", () => { 
  hoveringBaseElement = false; 
  setTimeout(checkHideBaseUI, 50); 
});

baseUIElement.addEventListener("mouseenter", () => hoveringBaseUI = true);
baseUIElement.addEventListener("mouseleave", () => { 
  hoveringBaseUI = false; 
  setTimeout(checkHideBaseUI, 50); 
});

function showBaseUI() {
  baseUIElement.style.display = "block";
  positionUIPanel(baseUIElement, baseElement);
  generateBaseUpgradeUI();
}

// ==========================
// BASE UPGRADES
function generateBaseUpgradeUI() {
  const container = document.getElementById("baseUpgrades");
  container.innerHTML = "";

  const upgrades = [
    { 
      label: "Generation Speed", 
      getCost: () => 10 * baseStats.generationLevel, 
      getEffect: () => {
        const currentRate = parseFloat((1000 / baseStats.generationInterval).toFixed(2));
        const nextInterval = baseStats.generationInterval / 1.5;
        const nextRate = parseFloat((1000 / nextInterval).toFixed(2));
        return `${currentRate} → ${nextRate} / sec`;
      },
      action: () => { 
        baseStats.generationLevel++; 
        baseStats.generationInterval /= 1.5;
      }
    },
    { 
  label: "Max Health", 
  getCost: () => 15 * baseStats.healthLevel, // now uses healthLevel
  getEffect: () => `${baseStats.maxHealth} → ${baseStats.maxHealth + 20}`,
  action: () => { 
    baseStats.maxHealth += 20; 
    baseStats.health += 20; 
    baseStats.healthLevel++; // increment level on upgrade
  }
},
    { 
      label: "Repair", 
      getCost: () => Math.ceil((baseStats.maxHealth - baseStats.health) / 10),
      getEffect: () => `${baseStats.health} → ${baseStats.maxHealth}`,
      action: () => { 
        const missing = baseStats.maxHealth - baseStats.health;
        baseStats.health += Math.min(missing, 10 * Math.ceil(missing / 10));
      }
    }
  ];

  upgrades.forEach(up => {
    const btn = document.createElement("button");

    // Store upgrade reference
    btn._baseUpgradeData = up;

    // Single click handler
    btn.onclick = () => {
      if (btn.disabled) return;

      const cost = up.getCost();
      if (core < cost) return; // affordability check

      core -= cost;
      up.action();
      updateResourceDisplay();
      updateBaseHealthDisplay();
      generateBaseUpgradeUI(); // refresh buttons after upgrade
    };

    container.appendChild(btn);
  });

  refreshBaseUIButtons();
}

// ==========================
// BUTTON REFRESH
function refreshBaseUIButtons() {
  const container = document.getElementById("baseUpgrades");
  const buttons = container.querySelectorAll("button");

  buttons.forEach(btn => {
    if (!btn._baseUpgradeData) return;

    const up = btn._baseUpgradeData;
    const cost = up.getCost();
    let canAfford = core >= cost;

    // Special case for Repair
    if (up.label === "Repair" && baseStats.health >= baseStats.maxHealth) {
      canAfford = false;
    }

    btn.innerText = `${up.label}: ${up.getEffect()} (${cost} Core)`;
    btn.disabled = !canAfford;

    btn.classList.toggle("upgrade-available", canAfford);
    btn.classList.toggle("upgrade-disabled", !canAfford);
  });
}

// ==========================
function checkHideBaseUI() {
  if (!hoveringBaseElement && !hoveringBaseUI) {
    baseUIElement.style.display = "none";
  }
}

// ==========================
// RESOURCE GENERATION
let baseAccumulator = 0;
function updateBaseProduction(dt) {
  baseAccumulator += dt * 1000;
  while (baseAccumulator >= baseStats.generationInterval) {
    baseAccumulator -= baseStats.generationInterval;
    metal += 1;
    energy += 1;
    updateResourceDisplay();
  }
}

// ==========================
// BOTTOM PANEL
function generateBottomPanel() {
  const panel = document.getElementById("towerStatsPanel");
  panel.innerHTML = "";

  Object.entries(towerTypes).forEach(([key,type], index)=>{
    const card = document.createElement("div");
    card.classList.add("tower-card");
    card.dataset.type = key;

    const shotsPerSecond = parseFloat((1000 / type.fireRate).toFixed(2));
    const rangeInTiles = parseFloat((type.range / gridSize).toFixed(2));

    const previewWrapper = document.createElement("div");
    previewWrapper.style.width = "28px";
    previewWrapper.style.height = "28px";
    previewWrapper.style.display = "flex";
    previewWrapper.style.alignItems = "center";
    previewWrapper.style.justifyContent = "center";
    previewWrapper.style.marginRight = "8px";

    const previewTower = document.createElement("div");
    previewTower.classList.add("tower");
    previewTower.classList.add(key);
    previewTower.style.position = "relative";
    previewTower.style.left = "0px";
    previewTower.style.top = "0px";
    previewTower.style.transform = "scale(0.8)";

    const previewGun = document.createElement("div");
    previewGun.classList.add("gun");
    previewTower.appendChild(previewGun);

    previewWrapper.appendChild(previewTower);

    const stats = document.createElement("div");
    stats.style.fontSize = "12px";
    stats.innerHTML = `
        Fire: ${shotsPerSecond} /sec<br>
        Range: ${rangeInTiles} tiles<br>
        Damage: ${type.damage}<br>
        Metal: ${type.cost.metal}<br>
        Energy: ${type.cost.energy}
    `;

    const indexLabel = document.createElement("div");
    indexLabel.style.fontWeight = "bold";
    indexLabel.style.marginRight = "6px";
    indexLabel.innerText = index + 1;

    card.appendChild(indexLabel);
    card.appendChild(previewWrapper);
    card.appendChild(stats);

    card.addEventListener("click", () => {
      selectedTowerType = key;
      updateTowerSelectionUI();
    });

    panel.appendChild(card);
  });

  updateTowerSelectionUI();
}

function updateTowerSelectionUI() {
  document.querySelectorAll(".tower-card").forEach(card=>card.classList.remove("selected"));
  const selected = document.querySelector(`.tower-card[data-type="${selectedTowerType}"]`);
  if(selected) selected.classList.add("selected");
}

generateBottomPanel();

// ==========================
// ENEMY TYPES
const enemyTypes = {
  grunt: { name: "Grunt", health: 30, speed: 0.8, damage: 10, color: "darkblue", size: 30, rewardCore: 5 },
  tank: { name: "Tank", health: 60, speed: 0.4, damage: 20, color: "red", size: 40, rewardCore: 15 },
  fast: { name: "Fast", health: 20, speed: 1.6, damage: 5, color: "lightblue", size: 20, rewardCore: 2 }
};

// ==========================
// SPAWN ENEMY FUNCTION
function spawnEnemy(typeKey) {
  const type = enemyTypes[typeKey];
  const waveScaling = Math.pow(1.08, currentWaveIndex);

  // Create main enemy container
  const enemy = document.createElement("div");
  enemy.classList.add("enemy", typeKey);
  enemy.style.width = type.size + "px";
  enemy.style.height = type.size + "px";
  enemy.style.position = "absolute";
  enemy.style.left = "0px";
  enemy.style.top = (6 * gridSize + 7) + "px";
  enemy.style.zIndex = 1;

  // --- GRUNT STRUCTURE ---
if (typeKey === "grunt") {
  // Create the main grunt container
  const grunt = document.createElement("div");
  grunt.classList.add("grunt");
 grunt.classList.add("enemy");

  // HEAD
  const head = document.createElement("div");
  head.classList.add("grunt-head");

  const steamStack = document.createElement("div");
  steamStack.classList.add("steam-stack");
  head.appendChild(steamStack);

  const steamPuff = document.createElement("div");
  steamPuff.classList.add("steam-puff");
  head.appendChild(steamPuff);

  for (let i = 1; i <= 4; i++) {
    const hpanel = document.createElement("div");
    hpanel.classList.add(`hpanel${i}`);
    head.appendChild(hpanel);
  }

  const faceplate = document.createElement("div");
  faceplate.classList.add("grunt-faceplate");
  head.appendChild(faceplate);

  grunt.appendChild(head);

  // TORSO
  const torso = document.createElement("div");
  torso.classList.add("grunt-torso");

  for (let i = 1; i <= 6; i++) {
    const tpanel = document.createElement("div");
    tpanel.classList.add(`tpanel${i}`);
    torso.appendChild(tpanel);
  }

  grunt.appendChild(torso);

  // ARMS
  ["front-arm", "back-arm"].forEach(armClass => {
    const arm = document.createElement("div");
    arm.classList.add("arm", armClass);

    // Shoulder gear
    const shoulder = document.createElement("div");
    shoulder.classList.add("shoulder-gear");

    for (let i = 1; i <= 4; i++) {
      const spoke = document.createElement("div");
      spoke.classList.add("spoke", `spoke${i}`);
      shoulder.appendChild(spoke);
    }

    for (let i = 1; i <= 8; i++) {
      const tooth = document.createElement("div");
      tooth.classList.add("tooth", `tooth${i}`);
      shoulder.appendChild(tooth);
    }

    arm.appendChild(shoulder);

    // Brass pipe
    const pipe = document.createElement("div");
    pipe.classList.add("brass-pipe");
    arm.appendChild(pipe);

    // Palm gear
    const palm = document.createElement("div");
    palm.classList.add("palm-gear");

    for (let i = 1; i <= 4; i++) {
      const pSpoke = document.createElement("div");
      pSpoke.classList.add("palm-spoke", `palm-spoke${i}`);
      palm.appendChild(pSpoke);
    }

    for (let i = 1; i <= 8; i++) {
      const pTooth = document.createElement("div");
      pTooth.classList.add("palm-tooth", `palm-tooth${i}`);
      palm.appendChild(pTooth);
    }

    for (let i = 1; i <= 3; i++) {
      const claw = document.createElement("div");
      claw.classList.add("claw", `claw${i}`);
      palm.appendChild(claw);
    }

    arm.appendChild(palm);
    grunt.appendChild(arm);
  });

  // LEGS
  ["front-leg", "back-leg"].forEach(legClass => {
    const leg = document.createElement("div");
    leg.classList.add("leg", legClass);

    const legPipe = document.createElement("div");
    legPipe.classList.add("leg-pipe");
    leg.appendChild(legPipe);

    const foot = document.createElement("div");
    foot.classList.add("foot");
    leg.appendChild(foot);

    grunt.appendChild(leg);
  });

  // Optional: Shadow
  const shadow = document.createElement("div");
  shadow.classList.add("shadow");
  grunt.appendChild(shadow);

  // Append the fully built grunt container to the enemy
  enemy.appendChild(grunt);
}

if (typeKey === "fast") {
const fast = document.createElement("div");
fast.classList.add("enemy");
fast.classList.add("fast");

const prop1 = document.createElement("div");
prop1.classList.add("prop1");
const prop1_blade1 = document.createElement("div");
prop1_blade1.classList.add("prop1_blade1");
const prop1_blade2 = document.createElement("div");
prop1_blade2.classList.add("prop1_blade2");
const prop1_blade3 = document.createElement("div");
prop1_blade3.classList.add("prop1_blade3");
const prop1_enclosure = document.createElement("div");
prop1_enclosure.classList.add("prop1_enclosure");
prop1.appendChild(prop1_blade1);
prop1.appendChild(prop1_blade2);
prop1.appendChild(prop1_blade3);
prop1.appendChild(prop1_enclosure);
fast.appendChild(prop1);
const prop2 = document.createElement("div");
prop2.classList.add("prop2");
const prop2_blade1 = document.createElement("div");
prop2_blade1.classList.add("prop2_blade1");
const prop2_blade2 = document.createElement("div");
prop2_blade2.classList.add("prop2_blade2");
const prop2_blade3 = document.createElement("div");
prop2_blade3.classList.add("prop2_blade3");
const prop2_enclosure = document.createElement("div");
prop2_enclosure.classList.add("prop2_enclosure");
prop2.appendChild(prop2_blade1);
prop2.appendChild(prop2_blade2);
prop2.appendChild(prop2_blade3);
prop2.appendChild(prop2_enclosure);
fast.appendChild(prop2);
const prop3 = document.createElement("div");
prop3.classList.add("prop3");
const prop3_blade1 = document.createElement("div");
prop3_blade1.classList.add("prop3_blade1");
const prop3_blade2 = document.createElement("div");
prop3_blade2.classList.add("prop3_blade2");
const prop3_blade3 = document.createElement("div");
prop3_blade3.classList.add("prop3_blade3");
const prop3_enclosure = document.createElement("div");
prop3_enclosure.classList.add("prop3_enclosure")
prop3.appendChild(prop3_blade1);
prop3.appendChild(prop3_blade2);
prop3.appendChild(prop3_blade3);
prop3.appendChild(prop3_enclosure);
fast.appendChild(prop3);
const prop4 = document.createElement("div");
prop4.classList.add("prop4");
const prop4_blade1 = document.createElement("div");
prop4_blade1.classList.add("prop4_blade1");
const prop4_blade2 = document.createElement("div");
prop4_blade2.classList.add("prop4_blade2");
const prop4_blade3 = document.createElement("div");
prop4_blade3.classList.add("prop4_blade3")
const prop4_enclosure = document.createElement("div");
prop4_enclosure.classList.add("prop4_enclosure")
prop4.appendChild(prop4_blade1);
prop4.appendChild(prop4_blade2);
prop4.appendChild(prop4_blade3);
prop4.appendChild(prop4_enclosure);
fast.appendChild(prop4);
const center = document.createElement("div");
center.classList.add("body");
fast.appendChild(center);
const a1 = document.createElement("div");
a1.classList.add("arm1");
fast.appendChild(a1);
const a2 = document.createElement("div");
a2.classList.add("arm2");
fast.appendChild(a2);
const a3 = document.createElement("div");
a3.classList.add("arm3");
fast.appendChild(a3);
const a4 = document.createElement("div");
a4.classList.add("arm4");
fast.appendChild(a4);
  enemy.appendChild(fast);
}

if (typeKey === "tank") {
  const tank = document.createElement("div");
  tank.classList.add("tank", "enemy");

  // Body
  const body = document.createElement("div");
  body.classList.add("tank_body");
  tank.appendChild(body);

  // === HELPER: create gear ===
  function createGear(prefix) {
    const gear = document.createElement("div");
    gear.classList.add(prefix);

    // Teeth
    for (let i = 1; i <= 8; i++) {
      const tooth = document.createElement("div");
      tooth.classList.add(`${prefix}_tooth`, `${prefix}_tooth${i}`);
      gear.appendChild(tooth);
    }

    // Spokes
    for (let i = 1; i <= 4; i++) {
      const spoke = document.createElement("div");
      spoke.classList.add(`${prefix}_spoke`, `${prefix}_spoke${i}`);
      gear.appendChild(spoke);
    }

    return gear;
  }

  // === BUILD ALL 6 LEGS ===
  for (let i = 1; i <= 6; i++) {
    const leg = document.createElement("div");
    leg.classList.add(`leg${i}`);

    // UPPER SEGMENT
    const upper = document.createElement("div");
    upper.classList.add(`leg${i}_upper_segment`);

    const upperGear = createGear(`leg${i}_upper_gear`);
    upper.appendChild(upperGear);

    const upperPipe = document.createElement("div");
    upperPipe.classList.add(`leg${i}_upper_pipe`);
    upper.appendChild(upperPipe);

    // MIDDLE SEGMENT
    const middle = document.createElement("div");
    middle.classList.add(`leg${i}_middle_segment`);

    const middleGear = createGear(`leg${i}_middle_gear`);
    middle.appendChild(middleGear);

    const middlePipe = document.createElement("div");
    middlePipe.classList.add(`leg${i}_middle_pipe`);
    middle.appendChild(middlePipe);

    // LOWER SEGMENT
    const lower = document.createElement("div");
    lower.classList.add(`leg${i}_lower_segment`);

    const lowerGear = createGear(`leg${i}_lower_gear`);
    lower.appendChild(lowerGear);

    const foot = document.createElement("div");
    foot.classList.add(`leg${i}_foot`);
    lower.appendChild(foot);

    // === NEST STRUCTURE ===
    middle.appendChild(lower);
    upper.appendChild(middle);
    leg.appendChild(upper);
    tank.appendChild(leg);
  }

  enemy.appendChild(tank);
}

  // Add to game
  game.appendChild(enemy);

  // Store enemy data
  enemies.push({
    element: enemy,
    x: 0,
    y: 6 * gridSize + 7,
    speed: type.speed,
    health: type.health * waveScaling,
    damage: type.damage,
    rewardCore: type.rewardCore,
    typeKey: typeKey // ⭐ REQUIRED FOR SAVE/LOAD
  });
}

// ==========================
// WAVE CONTROL
let currentWaveIndex = 0;
let enemiesToSpawn = [];
let waveSpawning = false;
const spawnInterval = 800;
let waveCountdown = 10;
let countdownActive = false;

const waveDisplay = document.createElement("div");
waveDisplay.style.position = "absolute";
waveDisplay.style.top = "10px";
waveDisplay.style.left = "50%";
waveDisplay.style.transform = "translateX(-50%)";
waveDisplay.style.background = "rgba(0,0,0,0.5)";
waveDisplay.style.color = "#fff";
waveDisplay.style.padding = "5px 10px";
waveDisplay.style.borderRadius = "5px";
document.body.appendChild(waveDisplay);

function startNextWave() {
  currentWaveIndex++;
  waveDisplay.innerText = `Wave ${currentWaveIndex}`;

  enemiesToSpawn = [];

  // ==========================
  // EXPONENTIAL SCALING BASE
  // ==========================
  const wavePower = Math.pow(1.10, currentWaveIndex);

  // ==========================
  // GRUNTS (core swarm)
  // ==========================
  const gruntCount = Math.floor(3 * wavePower);

  for (let i = 0; i < gruntCount; i++) {
    enemiesToSpawn.push("grunt");
  }

  // ==========================
  // TANKS (unlock wave 10)
  // ==========================
  let tankCount = 0;
  if (currentWaveIndex >= 10) {
    tankCount = Math.max(1, Math.floor(0.25 * wavePower));
  }

  for (let i = 0; i < tankCount; i++) {
    enemiesToSpawn.push("tank");
  }

  // ==========================
  // FAST (unlock wave 5)
  // ==========================
  let fastCount = 0;
  if (currentWaveIndex >= 5) {
    fastCount = Math.max(1, Math.floor(0.15 * wavePower));
  }

  for (let i = 0; i < fastCount; i++) {
    enemiesToSpawn.push("fast");
  }

  // ==========================
  // SAFETY: ensure variety
  // (prevents empty / stale waves)
  // ==========================
  if (enemiesToSpawn.length === 0) {
    enemiesToSpawn.push("grunt");
  }

  waveSpawning = true;
  countdownActive = false;
}

function spawnWaveEnemies(dt) {
  if (!waveSpawning) return;

  spawnTimer += dt*1000;
  while (spawnTimer >= spawnInterval && enemiesToSpawn.length > 0) {
    spawnTimer -= spawnInterval;
    const type = enemiesToSpawn.shift();
    spawnEnemy(type);
  }

  if (enemiesToSpawn.length === 0) waveSpawning = false;
}

// ==========================
// BULLETS
function createBullet(x, y, target, damage) {
  const el = document.createElement("div");
  el.classList.add("bullet");
  el.style.position = "absolute";
  el.style.width = "8px";
  el.style.height = "8px";
  el.style.background = "yellow";
  el.style.borderRadius = "50%";
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.zIndex = "3";
  game.appendChild(el);

  bullets.push({ x, y, element: el, target, damage });
}

function updateTowerRotation(dt) {
  towers.forEach(tower => {
    // Find nearest enemy in range
    tower.target = enemies.find(en => {
      const dx = (en.x + en.element.offsetWidth/2) - (tower.x + 25);
      const dy = (en.y + en.element.offsetHeight/2) - (tower.y + 25);
      return Math.sqrt(dx*dx + dy*dy) <= tower.range;
    });

    if (tower.target) {
      const dx = (tower.target.x + tower.target.element.offsetWidth/2) - (tower.x + 25);
      const dy = (tower.target.y + tower.target.element.offsetHeight/2) - (tower.y + 25);
      const desiredAngle = Math.atan2(dy, dx) * 180 / Math.PI + 90; // adjust for your CSS rotation

      // Smooth rotation
      const rotationSpeed = 360; // degrees per second
      let angleDiff = normalizeAngle(desiredAngle - tower.rotation);

      const maxStep = rotationSpeed * dt;
      if (Math.abs(angleDiff) < maxStep) tower.rotation = desiredAngle;
      else tower.rotation += Math.sign(angleDiff) * maxStep;

      tower.barrel.style.transform = `translateX(-50%) rotate(${tower.rotation}deg)`;
    }
  });
}

// Helper to normalize angles so rotation is shortest path
function normalizeAngle(angle) {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

// ==========================
// GAME LOOP
let lastTime = performance.now();
let spawnTimer = 0;

function gameLoop(now) {
  if (paused) { requestAnimationFrame(gameLoop); return; }

  const dt = (now - lastTime)/1000;
  lastTime = now;

  updateEnemies(dt);
  updateBullets(dt);
  handleTowerFiring(Date.now());
  updateTowerRotation(dt);
  updateBaseProduction(dt);
  spawnWaveEnemies(dt);

  if (!waveSpawning && enemies.length === 0 && !countdownActive) {
    countdownActive = true;
    waveCountdown = 10;
    const countdown = setInterval(() => {
      waveCountdown--;
      waveDisplay.innerText = `Next wave in ${waveCountdown}s`;
      if (waveCountdown <= 0) {
        clearInterval(countdown);
        startNextWave();
      }
    }, 1000);
  }

  requestAnimationFrame(gameLoop);
}

// ==========================
// TOWER FIRING
function handleTowerFiring(now) {
  towers.forEach(t => {
    if (now - t.lastShot <= t.fireRate) return;

    // ==========================
    // FIND FRONT-MOST ENEMY IN RANGE
    // ==========================
    let target = null;
    let maxProgress = -Infinity;

    const towerCenterX = t.x + 25;
    const towerCenterY = t.y + 25;

    for (let i = 0; i < enemies.length; i++) {
      const en = enemies[i];
      if (!en || !en.element) continue;

      const enemyCenterX = en.x + en.element.offsetWidth / 2;
      const enemyCenterY = en.y + en.element.offsetHeight / 2;

      const dx = towerCenterX - enemyCenterX;
      const dy = towerCenterY - enemyCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= t.range) {
        // TRUE path progress (front-most enemy)
        const progress = en.x + en.element.offsetWidth;

        if (progress > maxProgress) {
          maxProgress = progress;
          target = en;
        }
      }
    }

    if (!target) return;

    t.lastShot = now;

    const gun = t.element.querySelector(".gun");
    if (!gun) return;

    const dx = (target.x + target.element.offsetWidth / 2) - towerCenterX;
    const dy = (target.y + target.element.offsetHeight / 2) - towerCenterY;

    const angleDeg = t.rotation;
    const gunLength = gun.offsetHeight;
    const angleRad = (angleDeg - 90) * (Math.PI / 180);

    const bulletX = towerCenterX + Math.cos(angleRad) * gunLength;
    const bulletY = towerCenterY + Math.sin(angleRad) * gunLength;

    createBullet(bulletX, bulletY, target, t.damage);
  });
}

// ==========================
// BULLETS UPDATE
function updateBullets(dt) {
  const bulletSpeed = 300; // px/sec
  for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
    const b = bullets[bIndex];
    if (!enemies.includes(b.target)) {
      b.element.remove();
      bullets.splice(bIndex, 1);
      continue;
    }

    const target = b.target;
    const dx = (target.x + target.element.offsetWidth/2) - b.x;
    const dy = (target.y + target.element.offsetHeight/2) - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const moveDist = bulletSpeed * dt;

    if (dist <= moveDist) {
      target.health -= b.damage;
      if (target.health <= 0) {
        core += target.rewardCore;
        target.element.remove();
        enemies.splice(enemies.indexOf(target), 1);
        updateResourceDisplay();
      }
      b.element.remove();
      bullets.splice(bIndex, 1);
      continue;
    }

    b.x += (dx / dist) * moveDist;
    b.y += (dy / dist) * moveDist;

    b.element.style.left = b.x + "px";
    b.element.style.top = b.y + "px";
  }
}

// ==========================
// ENEMIES UPDATE
function updateEnemies(dt) {
  for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
    const enemy = enemies[eIndex];
    enemy.x += enemy.speed * dt * gridSize;
    enemy.element.style.left = enemy.x + "px";

    const baseGridX = 16 * gridSize;
    const baseGridY = 6 * gridSize;
    const baseWidth = gridSize;
    const baseHeight = gridSize;

    const enemyWidth = enemy.element.offsetWidth;
    const enemyHeight = enemy.element.offsetHeight;

    if (
      enemy.x + enemyWidth > baseGridX &&
      enemy.x < baseGridX + baseWidth &&
      enemy.y + enemyHeight > baseGridY &&
      enemy.y < baseGridY + baseHeight
    ) {
      damageBase(enemy.damage);
      enemy.element.remove();
      enemies.splice(eIndex, 1);
      continue;
    }

    if (enemy.x > game.offsetWidth || enemy.y > game.offsetHeight) {
      enemy.element.remove();
      enemies.splice(eIndex, 1);
    }
  }
checkGameOver();
}

// ==========================
// VISIBILITY HANDLING
document.addEventListener("visibilitychange", () => {
  if (!gameStarted) return; // 🔒 do nothing if game hasn't started

  if (document.hidden) {
    paused = true; // pause the game when tab is hidden
  } else {
    paused = false; // resume the game when tab is visible
    lastTime = performance.now(); // reset timing to avoid big delta
    requestAnimationFrame(gameLoop);
  }
});

// ==========================
// UI AUTO-HIDE ON HOVER (SAFE VERSION)
// ==========================

const resourceDisplay = document.getElementById("resourceDisplay");
const towerPanel = document.getElementById("towerStatsPanel");

let hoveringUIBlockers = false;

function hideElement(el) {
  el.style.opacity = "0";
  el.style.transition = "opacity 0.15s ease";
}

function showElement(el) {
  el.style.opacity = "1";
  el.style.transition = "opacity 0.15s ease";
}

// --------------------------
// RESOURCE DISPLAY
// --------------------------
if (resourceDisplay) {
  resourceDisplay.addEventListener("mouseenter", () => {
    hoveringUIBlockers = true;
    hideElement(resourceDisplay);
  });

  resourceDisplay.addEventListener("mouseleave", () => {
    hoveringUIBlockers = false;
    showElement(resourceDisplay);
  });
}

// --------------------------
// TOWER CARDS PANEL
// --------------------------
if (towerPanel) {
  towerPanel.addEventListener("mouseenter", () => {
    hoveringUIBlockers = true;
    hideElement(towerPanel);
  });

  towerPanel.addEventListener("mouseleave", () => {
    hoveringUIBlockers = false;
    showElement(towerPanel);
  });
}
