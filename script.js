
"use strict";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");

const SAVE_KEY = "neonRacingSaveV4";
const defaults = {
  language: "en",
  firstName: "",
  lastName: "",
  device: "pc",
  coins: 0,
  best: 0,
  upgrades: { engine: 0, nitro: 0, armor: 0, car: 0 }
};

function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    return {
      ...defaults,
      ...raw,
      upgrades: { ...defaults.upgrades, ...(raw.upgrades || {}) }
    };
  } catch {
    return structuredClone(defaults);
  }
}

let save = loadSave();

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

const translations = {
  en: {
    profileTitle: "Player profile", firstName: "First name",
    lastName: "Last name", continue: "Continue",
    deviceTitle: "Choose your device", computer: "Computer",
    phone: "Phone", shop: "Upgrade shop", profile: "Profile",
    back: "Back", deviceLabel: "Device", bestLabel: "Best score",
    start: "START", restart: "PLAY AGAIN",
    ready: "Avoid the traffic and collect coins!",
    over: "Game over!", paused: "Paused",
    engine: "Engine", nitro: "Nitro", armor: "Armor",
    car: "Car color", buy: "Upgrade", max: "MAX",
    insufficient: "Not enough coins!", devicePC: "Computer",
    devicePhone: "Phone", needName: "Enter your first and last name."
  },
  hy: {
    profileTitle: "Խաղացողի տվյալներ", firstName: "Անուն",
    lastName: "Ազգանուն", continue: "Շարունակել",
    deviceTitle: "Ընտրիր սարքը", computer: "Համակարգիչ",
    phone: "Հեռախոս", shop: "Բարելավումների խանութ",
    profile: "Պրոֆիլ", back: "Հետ",
    deviceLabel: "Սարք", bestLabel: "Լավագույն միավոր",
    start: "ՍԿՍԵԼ", restart: "ԿՐԿԻՆ ԽԱՂԱԼ",
    ready: "Խուսափիր մեքենաներից և հավաքիր մետաղադրամներ։",
    over: "Խաղն ավարտվեց։", paused: "Դադար",
    engine: "Շարժիչ", nitro: "Նիտրո", armor: "Զրահ",
    car: "Մեքենայի գույն", buy: "Բարելավել", max: "ԱՌԱՎԵԼԱԳՈՒՅՆ",
    insufficient: "Մետաղադրամները չեն բավականացնում։",
    devicePC: "Համակարգիչ", devicePhone: "Հեռախոս",
    needName: "Մուտքագրիր անունն ու ազգանունը։"
  },
  ru: {
    profileTitle: "Профиль игрока", firstName: "Имя",
    lastName: "Фамилия", continue: "Продолжить",
    deviceTitle: "Выбери устройство", computer: "Компьютер",
    phone: "Телефон", shop: "Магазин улучшений",
    profile: "Профиль", back: "Назад",
    deviceLabel: "Устройство", bestLabel: "Лучший результат",
    start: "СТАРТ", restart: "ИГРАТЬ СНОВА",
    ready: "Избегай машин и собирай монеты!",
    over: "Игра окончена!", paused: "Пауза",
    engine: "Двигатель", nitro: "Нитро", armor: "Броня",
    car: "Цвет машины", buy: "Улучшить", max: "МАКСИМУМ",
    insufficient: "Недостаточно монет!",
    devicePC: "Компьютер", devicePhone: "Телефон",
    needName: "Введи имя и фамилию."
  }
};

function t(key) {
  return translations[save.language]?.[key] ?? translations.en[key] ?? key;
}

function translatePage() {
  document.documentElement.lang = save.language;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.lang === save.language);
  });
}

const screenIds = [
  "language-screen", "profile-screen", "device-screen",
  "game-screen", "shop-screen", "profile-details-screen"
];

function showScreen(id) {
  screenIds.forEach(screen => $(screen).classList.toggle("hidden", screen !== id));
}

function updateUI() {
  $("coins").textContent = save.coins;
  $("shop-coins").textContent = save.coins;
  $("best").textContent = save.best;
  $("profile-best").textContent = save.best;
  $("profile-coins").textContent = save.coins;
  $("player-name")?.replaceChildren();
  $("profile-full-name").textContent =
    `${save.firstName} ${save.lastName}`.trim();
  $("profile-device").textContent = t(save.device === "pc" ? "devicePC" : "devicePhone");
  $("keyboard-help").classList.toggle("hidden", save.device !== "pc");
  $("touch-controls").classList.toggle("hidden", save.device !== "phone");
}

document.querySelectorAll("[data-lang]").forEach(btn => {
  btn.addEventListener("click", () => {
    save.language = btn.dataset.lang;
    persist();
    translatePage();
    showScreen("profile-screen");
  });
});

$("profile-form").addEventListener("submit", event => {
  event.preventDefault();
  save.firstName = $("first-name").value.trim();
  save.lastName = $("last-name").value.trim();
  if (!save.firstName || !save.lastName) {
    alert(t("needName"));
    return;
  }
  persist();
  translatePage();
  showScreen("device-screen");
});

document.querySelectorAll("[data-device]").forEach(btn => {
  btn.addEventListener("click", () => {
    save.device = btn.dataset.device;
    persist();
    updateUI();
    translatePage();
    showScreen("game-screen");
    showReady();
    draw();
  });
});

let state = "ready";
let score = 0;
let roadOffset = 0;
let spawnTimer = 0;
let lastTime = 0;
let enemyId = 0;
let coinsEarned = 0;
let nitroTime = 0;
let flashTime = 0;

const player = { x: 216, y: 590, w: 48, h: 82, vx: 0 };
const keys = { left: false, right: false, nitro: false };
let enemies = [];
let pickups = [];
let particles = [];

const laneCenters = [145, 240, 335];
const carColors = ["#00e5ff", "#ff36c7", "#ffdc42", "#75ff75", "#ffffff"];

function currentCarColor() {
  return carColors[save.upgrades.car % carColors.length];
}

function maxSpeed() {
  return 270 + save.upgrades.engine * 32;
}

function showReady() {
  state = "ready";
  $("game-overlay").classList.remove("hidden");
  $("game-overlay-title").textContent = "NEON RACING";
  $("game-overlay-text").textContent = t("ready");
  $("start-game-btn").textContent = t("start");
}

function startGame() {
  score = 0;
  roadOffset = 0;
  spawnTimer = 0;
  coinsEarned = 0;
  nitroTime = 0;
  flashTime = 0;
  enemies = [];
  pickups = [];
  particles = [];
  player.x = 216;
  player.vx = 0;
  state = "running";
  $("game-overlay").classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame() {
  if (state !== "running") return;
  state = "over";
  const earned = Math.floor(score / 100) + coinsEarned;
  save.coins += earned;
  save.best = Math.max(save.best, Math.floor(score));
  persist();
  updateUI();
  $("game-overlay").classList.remove("hidden");
  $("game-overlay-title").textContent = t("over");
  $("game-overlay-text").textContent =
    `${Math.floor(score)} points · +${earned} coins`;
  $("start-game-btn").textContent = t("restart");
}

$("start-game-btn").addEventListener("click", startGame);

function bindHoldButton(id, key) {
  const el = $(id);
  el.addEventListener("pointerdown", e => {
    e.preventDefault();
    keys[key] = true;
    el.setPointerCapture?.(e.pointerId);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
    el.addEventListener(name, () => { keys[key] = false; });
  }
}

bindHoldButton("left-btn", "left");
bindHoldButton("right-btn", "right");
bindHoldButton("nitro-btn", "nitro");

window.addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", " ", "a", "A", "d", "D"].includes(e.key)) {
    e.preventDefault();
  }
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = true;
  if (e.code === "Space") keys.nitro = true;
  if (e.key === "Escape" && state === "running") state = "paused";
  else if (e.key === "Escape" && state === "paused") {
    state = "running";
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
});

window.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = false;
  if (e.code === "Space") keys.nitro = false;
});

window.addEventListener("blur", () => {
  keys.left = keys.right = keys.nitro = false;
});

function spawnEnemy() {
  const lane = Math.floor(Math.random() * laneCenters.length);
  enemies.push({
    id: ++enemyId,
    x: laneCenters[lane] - 22,
    y: -100,
    w: 44,
    h: 76,
    color: ["#ff3e70", "#ffd447", "#a67bff"][Math.floor(Math.random() * 3)]
  });
}

function spawnCoin() {
  const lane = Math.floor(Math.random() * laneCenters.length);
  pickups.push({ x: laneCenters[lane], y: -25, r: 12, got: false });
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt) {
  const engine = save.upgrades.engine;
  const nitroLevel = save.upgrades.nitro;
  const armorLevel = save.upgrades.armor;
  const usingNitro = keys.nitro && nitroTime <= 0;

  let speed = maxSpeed() + Math.min(score * 0.035, 180);
  if (usingNitro) {
    speed += 150 + nitroLevel * 30;
    nitroTime = 0.35;
  }
  nitroTime = Math.max(0, nitroTime - dt * (usingNitro ? 0 : 1));
  flashTime = Math.max(0, flashTime - dt);

  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  player.vx += steer * 1100 * dt;
  player.vx *= Math.pow(0.001, dt);
  player.x += player.vx * dt;
  player.x = Math.max(65, Math.min(367, player.x));

  roadOffset = (roadOffset + speed * dt) % 100;
  score += speed * dt * 0.04;
  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    spawnEnemy();
    if (Math.random() < 0.42) spawnCoin();
    spawnTimer = Math.max(0.38, 1.05 - score / 5000);
  }

  enemies.forEach(enemy => { enemy.y += (speed * 0.72) * dt; });
  pickups.forEach(coin => { coin.y += speed * 0.72 * dt; });

  for (const enemy of enemies) {
    if (overlaps(player, enemy)) {
      if (armorLevel > 0) {
        save.upgrades.armor--;
        persist();
        enemies = enemies.filter(item => item.id !== enemy.id);
        flashTime = 0.6;
      } else {
        endGame();
        return;
      }
      break;
    }
  }

  pickups = pickups.filter(coin => {
    const hit = player.x < coin.x + coin.r &&
      player.x + player.w > coin.x - coin.r &&
      player.y < coin.y + coin.r &&
      player.y + player.h > coin.y - coin.r;
    if (hit && !coin.got) {
      coinsEarned++;
      coin.got = true;
      return false;
    }
    return coin.y < canvas.height + 30;
  });

  enemies = enemies.filter(enemy => enemy.y < canvas.height + 100);
  $("score").textContent = Math.floor(score);
  $("speed").textContent = Math.floor(speed / 4);
}

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawCar(x, y, w, h, color, isPlayer = false) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = isPlayer ? 20 : 8;
  roundedRect(x, y, w, h, 10, color);
  ctx.shadowBlur = 0;
  roundedRect(x + 7, y + 13, w - 14, 20, 5, "#10172a");
  roundedRect(x + 8, y + 43, w - 16, 15, 4, "#202b46");
  roundedRect(x + 4, y + 5, 8, 12, 2, "#f6ffff");
  roundedRect(x + w - 12, y + 5, 8, 12, 2, "#f6ffff");
  roundedRect(x + 3, y + h - 9, 8, 7, 2, "#070a13");
  roundedRect(x + w - 11, y + h - 9, 8, 7, 2, "#070a13");
  if (isPlayer && keys.nitro) {
    ctx.fillStyle = "#ff36c7";
    ctx.beginPath();
    ctx.moveTo(x + 13, y + h);
    ctx.lineTo(x + 19, y + h + 18 + Math.random() * 8);
    ctx.lineTo(x + 25, y + h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 25, y + h);
    ctx.lineTo(x + 31, y + h + 15 + Math.random() * 8);
    ctx.lineTo(x + 37, y + h);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#101d20";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#242738";
  ctx.fillRect(55, 0, 370, canvas.height);

  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(55, 0, 4, canvas.height);
  ctx.fillRect(421, 0, 4, canvas.height);

  ctx.fillStyle = "#d8e0ef";
  for (const x of [178, 302]) {
    for (let y = -100 + roadOffset; y < canvas.height; y += 100) {
      ctx.fillRect(x, y, 4, 48);
    }
  }

  pickups.forEach(coin => {
    ctx.beginPath();
    ctx.fillStyle = "#ffdc42";
    ctx.shadowColor = "#ffdc42";
    ctx.shadowBlur = 14;
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  enemies.forEach(enemy => drawCar(enemy.x, enemy.y, enemy.w, enemy.h, enemy.color));
  drawCar(player.x, player.y, player.w, player.h, currentCarColor(), true);

  if (flashTime > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashTime * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function loop(now) {
  if (state !== "running") {
    if (state === "paused") {
      draw();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(t("paused"), canvas.width / 2, canvas.height / 2);
    }
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  update(dt);
  draw();

  if (state === "running") requestAnimationFrame(loop);
}

const upgrades = [
  { id: "engine", key: "engine", max: 5, base: 100 },
  { id: "nitro", key: "nitro", max: 5, base: 120 },
  { id: "armor", key: "armor", max: 3, base: 150 },
  { id: "car", key: "car", max: 4, base: 200 }
];

function renderShop() {
  $("shop-coins").textContent = save.coins;
  const list = $("upgrade-list");
  list.replaceChildren();

  upgrades.forEach(item => {
    const level = save.upgrades[item.id];
    const price = item.base * (level + 1);
    const card = document.createElement("div");
    card.className = "upgrade";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${t(item.key)} · ${level}/${item.max}`;
    const description = document.createElement("p");
    description.textContent = item.id === "car"
      ? currentCarColor()
      : `${t(item.key)} ${level}`;

    info.append(title, description);
    const button = document.createElement("button");

    if (level >= item.max) {
      button.textContent = t("max");
      button.disabled = true;
    } else {
      button.textContent = `${t("buy")} · 🪙 ${price}`;
      button.addEventListener("click", () => {
        if (save.coins < price) {
          alert(t("insufficient"));
          return;
        }
        save.coins -= price;
        save.upgrades[item.id]++;
        persist();
        updateUI();
        renderShop();
      });
    }

    card.append(info, button);
    list.append(card);
  });
}

$("shop-btn").addEventListener("click", () => {
  renderShop();
  showScreen("shop-screen");
});

$("profile-btn").addEventListener("click", () => {
  updateUI();
  showScreen("profile-details-screen");
});

$("back-to-game").addEventListener("click", () => showScreen("game-screen"));
$("back-from-profile").addEventListener("click", () => showScreen("game-screen"));

translatePage();
updateUI();
showScreen("language-screen");
draw();

