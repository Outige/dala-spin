/*
  DALA SPIN-TO-WIN SETTINGS
  Edit this section to change prizes, wheel text, timing, sound, and result behavior.
*/
const appConfig = {
  heading: "Dala Prize Wheel",
  buttonText: "Spin",
  spinDurationMs: 6200,
  minRotations: 6,
  maxExtraRotations: 3,
  soundEnabled: true,
  soundVolume: 0.35,
  confettiEnabled: true,
  autoCloseResult: false,
  autoCloseDelayMs: 4500,
  allowImmediateRepeatedSpins: true,
  prizes: [
    {
      id: "stickers",
      name: "Sticker Pack",
      color: "#F4C542",
      weight: 40,
      message: "You won a sticker pack!"
    },
    {
      id: "brush",
      name: "Paint Brush",
      color: "#EF8354",
      weight: 30,
      message: "You won a paint brush!"
    },
    {
      id: "sample-pot",
      name: "Sample Pot",
      color: "#2FA7A0",
      weight: 20,
      message: "You won a Dala sample pot!"
    },
    {
      id: "paint-set",
      name: "Paint Set",
      color: "#4F5D75",
      weight: 10,
      message: "You won a paint set!"
    },
    {
      id: "voucher",
      name: "Trade Voucher",
      color: "#A23E48",
      weight: 8,
      message: "You won a trade-show voucher!"
    },
    {
      id: "grand-prize",
      name: "Grand Prize",
      color: "#166A5B",
      weight: 2,
      message: "Amazing! You won the grand prize."
    }
  ]
};

const TAU = Math.PI * 2;
const canvas = document.querySelector("#wheel");
const ctx = canvas.getContext("2d");
const heading = document.querySelector("#wheel-heading");
const spinButton = document.querySelector("#spin-button");
const statusText = document.querySelector("#status");
const modal = document.querySelector("#result-modal");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const closeModalButton = document.querySelector("#close-modal");

let rotation = 0;
let isSpinning = false;
let audioContext = null;
let autoCloseTimer = null;

function init() {
  heading.textContent = appConfig.heading;
  spinButton.textContent = appConfig.buttonText;
  drawWheel();
  spinButton.addEventListener("click", spinWheel);
  closeModalButton.addEventListener("click", closeResult);
  window.addEventListener("resize", drawWheel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeResult();
    }
  });
}

function drawWheel() {
  const prizes = getValidPrizes();
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 18;
  const segmentAngle = TAU / prizes.length;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(rotation - Math.PI / 2);

  prizes.forEach((prize, index) => {
    const start = index * segmentAngle;
    const end = start + segmentAngle;
    drawSegment(start, end, radius, prize.color);
    drawLabel(start + segmentAngle / 2, radius, prize.name, prizes.length);
  });

  ctx.restore();
  drawOuterRings(center, radius);
}

function drawSegment(start, end, radius, color) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, start, end);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

function drawLabel(angle, radius, text, prizeCount) {
  const label = shortenPrizeName(text, prizeCount);
  ctx.save();
  ctx.rotate(angle);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 6;
  ctx.font = `900 ${getLabelFontSize(prizeCount)}px Inter, Arial, sans-serif`;
  ctx.fillText(label, radius - 56, 0, radius * 0.48);
  ctx.restore();
}

function drawOuterRings(center, radius) {
  ctx.save();
  ctx.translate(center, center);
  ctx.beginPath();
  ctx.arc(0, 0, radius + 7, 0, TAU);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius - 6, 0, TAU);
  ctx.strokeStyle = "rgba(23, 32, 42, 0.18)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function getLabelFontSize(prizeCount) {
  if (prizeCount >= 14) return 24;
  if (prizeCount >= 10) return 30;
  if (prizeCount >= 7) return 36;
  return 44;
}

function shortenPrizeName(name, prizeCount) {
  const maxLength = prizeCount >= 10 ? 14 : prizeCount >= 7 ? 18 : 24;
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 1).trim()}...`;
}

function spinWheel() {
  if (isSpinning) return;
  if (!appConfig.allowImmediateRepeatedSpins && !modal.hidden) return;

  const prizes = getValidPrizes();
  const winner = selectWeightedPrize(prizes);
  const winningIndex = prizes.indexOf(winner);
  const segmentAngle = TAU / prizes.length;
  const segmentCenter = winningIndex * segmentAngle + segmentAngle / 2;
  const extraRotations = Math.floor(Math.random() * (appConfig.maxExtraRotations + 1));
  const fullRotations = appConfig.minRotations + extraRotations;
  const landingRotation = normalizeRotation(TAU - segmentCenter);
  const targetRotation = fullRotations * TAU + normalizeRotation(landingRotation - normalizeRotation(rotation));
  const startRotation = rotation;
  const finalRotation = startRotation + targetRotation;
  const startTime = performance.now();

  isSpinning = true;
  maybeTick.lastTick = null;
  spinButton.disabled = true;
  statusText.textContent = "Spinning...";
  closeResult();
  playSpinStart();

  requestAnimationFrame(function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / appConfig.spinDurationMs, 1);
    const eased = easeSpinWithSuspense(progress);
    rotation = startRotation + (finalRotation - startRotation) * eased;
    drawWheel();
    maybeTick(progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = normalizeRotation(finalRotation);
    drawWheel();
    finishSpin(winner);
  });
}

function selectWeightedPrize(prizes) {
  const totalWeight = prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  let draw = Math.random() * totalWeight;

  for (const prize of prizes) {
    draw -= Number(prize.weight || 0);
    if (draw <= 0) return prize;
  }

  return prizes[prizes.length - 1];
}

function finishSpin(winner) {
  isSpinning = false;
  spinButton.disabled = false;
  statusText.textContent = `${winner.name} won.`;
  playWinSound();
  showResult(winner);
}

function showResult(prize) {
  clearTimeout(autoCloseTimer);
  resultTitle.textContent = prize.name;
  resultMessage.textContent = prize.message || `You won ${prize.name}!`;
  modal.hidden = false;
  closeModalButton.focus({ preventScroll: true });
  launchConfetti();

  if (appConfig.autoCloseResult) {
    autoCloseTimer = setTimeout(closeResult, appConfig.autoCloseDelayMs);
  }
}

function closeResult() {
  clearTimeout(autoCloseTimer);
  modal.hidden = true;
}

function getValidPrizes() {
  const prizes = appConfig.prizes.filter((prize) => Number(prize.weight) > 0);
  if (!prizes.length) {
    throw new Error("Add at least one prize with a weight greater than zero.");
  }
  return prizes;
}

function normalizeRotation(value) {
  return ((value % TAU) + TAU) % TAU;
}

function easeSpinWithSuspense(progress) {
  const accelerationPortion = 0.16;

  if (progress < accelerationPortion) {
    const accelerated = progress / accelerationPortion;
    return 0.13 * accelerated * accelerated;
  }

  const coastProgress = (progress - accelerationPortion) / (1 - accelerationPortion);
  return 0.13 + 0.87 * (1 - Math.pow(1 - coastProgress, 4.6));
}

function maybeTick(progress) {
  if (!appConfig.soundEnabled || progress <= 0 || progress >= 0.98) return;
  const tickWindow = Math.floor(rotation / (TAU / getValidPrizes().length));
  if (maybeTick.lastTick === tickWindow) return;
  maybeTick.lastTick = tickWindow;
  playTick(progress);
}

function getAudioContext() {
  if (!appConfig.soundEnabled || (!window.AudioContext && !window.webkitAudioContext)) {
    return null;
  }

  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function getSoundVolume(multiplier = 1) {
  return Math.max(0, Math.min(1, appConfig.soundVolume)) * multiplier;
}

function playSpinStart() {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(160, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(420, context.currentTime + 0.22);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(getSoundVolume(0.11), context.currentTime + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.26);
}

function playTick(progress) {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const pitch = 820 - progress * 260;
  const volume = getSoundVolume(0.12 - progress * 0.06);
  oscillator.type = "triangle";
  oscillator.frequency.value = pitch;
  gain.gain.setValueAtTime(Math.max(0.01, volume), context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.032);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.04);
}

function playWinSound() {
  const context = getAudioContext();
  if (!context) return;

  [0, 0.09, 0.18].forEach((delay, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = [523.25, 659.25, 783.99][index];
    gain.gain.setValueAtTime(0.001, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(getSoundVolume(0.13), context.currentTime + delay + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.27);
  });
}

function launchConfetti() {
  if (!appConfig.confettiEnabled) return;

  const colors = getValidPrizes().map((prize) => prize.color);
  const pieces = 120;

  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    piece.style.background = colors[index % colors.length];
    document.body.append(piece);
    piece.animate(
      [
        { transform: "translate3d(var(--x), -8vh, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate3d(calc(var(--x) - 12vw + ${Math.random() * 24}vw), 108vh, 0) rotate(var(--r))`, opacity: 0.95 }
      ],
      {
        duration: 1500 + Math.random() * 900,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)"
      }
    ).addEventListener("finish", () => piece.remove());
  }
}

const confettiStyle = document.createElement("style");
confettiStyle.textContent = `
  .confetti-piece {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 20;
    width: 10px;
    height: 16px;
    pointer-events: none;
  }
`;
document.head.append(confettiStyle);

init();
