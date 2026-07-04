/**
 * Pixel Flex - Single-Button Flask Game
 * Core Mechanics:
 * - Automated Movement
 * - Level Progression (1-5)
 * - Contextual Actions (Grab, Drop, Dodge Variants)
 * - Dynamic Hazard Speed (Slow-mo Proximity)
 * - Scrolling Camera System
 * - Single Input (Spacebar/Touch) with Debouncing
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State Constants
const STATES = {
    MENU: 'MENU',
    CALIBRATION: 'CALIBRATION',
    STORE: 'STORE',
    LEVEL_SELECT: 'LEVEL_SELECT',
    WALKING: 'WALKING',
    CLIMBING: 'CLIMBING',
    JUMPING: 'JUMPING',
    VAN_DRIVEAWAY: 'VAN_DRIVEAWAY',
    WAITING_FOR_ACTION: 'WAITING_FOR_ACTION',
    HAZARD_SLOWMO: 'HAZARD_SLOWMO',
    SUCCESS_TEXT: 'SUCCESS_TEXT',
    GAME_OVER: 'GAME_OVER',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE'
};

// Action Types
const ACTIONS = {
    GRAB: 'GRAB',
    DROP: 'DROP',
    DODGE: 'DODGE',
    CLIMB_UP: 'CLIMB_UP',
    CLIMB_DOWN: 'CLIMB_DOWN',
    SYNC_PULSE: 'SYNC_PULSE',
    JUMP_IN_VAN: 'JUMP_IN_VAN'
};

// Game Configuration
const CONFIG = {
    COLORS: {
        BG: '#000000',
        PRIMARY: '#00FFCC',
        FAIL: '#FF3300',
        STICKMAN: '#FFFFFF',
        OBJECT: '#FFFF00',
        STATION: '#444444',
        HAZARD_CAN: '#FF0000',
        HAZARD_BULLET: '#FFFF00',
        TRAIN_RED: '#CC0000',
        PERFECT: '#00FF00'
    },
    GROUND_Y: 380,
    STICKMAN_HEIGHT: 60,
    DODGE_DURATION: 600,
    REACTION_WINDOW: [0.8, 1.2],
    COMBO_WINDOW: [0.35, 0.65] // 30% "Perfect" window in the middle
};

// Level Data
const LEVELS = [
    {
        name: "Level 1: The Battery Fetch",
        speed: 2,
        tasks: [
            { type: ACTIONS.GRAB, x: 500, y: 380, label: "GRAB BATTERY", timer: [3, 5] },
            { type: ACTIONS.DROP, x: 140, y: 380, label: "DROP IN HOLDER", timer: [3, 5] }
        ],
        startPos: 140,
        startY: 380,
        stations: [
            { x: 100, y: 380, type: 'BASE' },
            { x: 540, y: 380, type: 'BATTERY' }
        ],
        theme: 'MOUNTAINS'
    },
    {
        name: "Level 2: The Fast Assembly",
        speed: 4,
        tasks: [
            { type: ACTIONS.GRAB, x: 500, y: 380, label: "QUICK GRAB!", timer: [2.8, 4.8] },
            { type: ACTIONS.DROP, x: 1000, y: 380, label: "QUICK DROP!", timer: [2.8, 4.8] }
        ],
        startPos: 140,
        startY: 380,
        endX: 1100,
        stations: [
            { x: 100, y: 380, type: 'BASE' },
            { x: 540, y: 380, type: 'CONVEYOR' },
            { x: 1040, y: 380, type: 'BASE' }
        ],
        theme: 'TRAIN'
    },
    {
        name: "Level 3: The Alley Hazard",
        speed: 2.5,
        tasks: [
            { type: ACTIONS.DODGE, x: 400, y: 380, label: "DODGE CAN!", timer: [2.6, 4.6], hazard: 'CAN' }
        ],
        startPos: 100,
        startY: 380,
        endX: 800,
        stations: [],
        weather: 'RAIN',
        theme: 'CITY'
    },
    {
        name: "Level 4: Obstacle Course",
        speed: 3,
        tasks: [
            { type: ACTIONS.GRAB, x: 300, y: 380, label: "GRAB!", timer: [2.4, 4.4] },
            { type: ACTIONS.CLIMB_UP, x: 450, y: 380, targetY: 200, label: "CLIMB!", timer: [2.4, 4.4] },
            { type: ACTIONS.DODGE, x: 800, y: 200, label: "DODGE!", timer: [2.4, 4.4], hazard: 'RANDOM' },
            { type: ACTIONS.DROP, x: 1100, y: 200, label: "DROP!", timer: [2.4, 4.4] }
        ],
        startPos: 100,
        startY: 380,
        endX: 1300,
        stations: [
            { x: 300, y: 380, type: 'BATTERY' },
            { x: 450, y: 380, type: 'LADDER', height: 180 },
            { x: 1100, y: 200, type: 'BASE' }
        ],
        theme: 'MOUNTAINS'
    },
    {
        name: "Level 5: The Bank Heist",
        speed: 3.5,
        tasks: [
            { type: ACTIONS.GRAB, x: 800, y: 380, label: "GRAB BAG!", timer: [2.3, 4.3] },
            { type: ACTIONS.CLIMB_UP, x: 600, y: 380, targetY: 200, label: "CLIMB UP!", timer: [2.3, 4.3] },
            { type: ACTIONS.DODGE, x: 400, y: 200, label: "DODGE!", timer: [2.3, 4.3], hazard: 'BULLET' },
            { type: ACTIONS.JUMP_IN_VAN, x: 140, y: 200, label: "JUMP IN!", timer: [2.3, 4.3] }
        ],
        startPos: 140,
        startY: 380,
        stations: [
            { x: 80, y: 380, type: 'VAN' },
            { x: 600, y: 380, type: 'LADDER', height: 180 },
            { x: 840, y: 380, type: 'MONEY' }
        ],
        continuousHazards: 'BULLET',
        theme: 'CITY'
    }
];

// Game State Variables
let currentLevelIdx = 0;
let gameState = STATES.MENU;
let score = 0;
let combo = 0;
let timerValue = 0;
let timerMax = 0;
let lastTimestamp = 0;
let hasObject = false;
let message = "PIXEL FLEX";
let messageColor = CONFIG.COLORS.PRIMARY;
let currentTaskIdx = 0;
let hazardObj = null;
let particles = [];
let weatherParticles = [];
let afterImages = [];
let successTextTimer = 0;
let duckingTimer = 0;
let shakeTimer = 0;
let timeScale = 1.0;
let reactionMultiplier = 1.0;
let nextHazardSpawnTime = 0;
let cameraX = -100;
let cameraY = 0;
let droppedItems = [];
let puddleRipples = [];

// --- MENU SYSTEM STATE ---
let menuAnimTime   = 0;
let mouseX = 0, mouseY = 0;
let selectedSkin      = 0;   // highlighted in shop
let currentActiveSkin = 0;   // equipped skin
const ownedSkins      = [true, false, false, false];
let selectedLevelNode = 0;
let maxUnlockedLevel  = 0;

const SKINS = [
    { name: 'CLASSIC', cost: 0,   bodyColor: '#FFFFFF', glowColor: '#888888', hat: false, armor: false },
    { name: 'NEON',    cost: 100, bodyColor: '#00FFEE', glowColor: '#00FFEE', hat: false, armor: false },
    { name: 'NINJA',   cost: 200, bodyColor: '#1a1a2e', glowColor: '#FF00FF', hat: false, armor: true  },
    { name: 'COWBOY',  cost: 150, bodyColor: '#C8A96E', glowColor: '#FF8800', hat: true,  armor: false },
];

const LEVEL_NODES = [
    { x: 80,  y: 370 },
    { x: 222, y: 305 },
    { x: 374, y: 200 },
    { x: 496, y: 280 },
    { x: 344, y: 145 },
];
const LEVEL_NODE_COLORS = ['#1a3a5c', '#2a153c', '#1a2a1a', '#3c2a1a', '#1a1a3a'];

// --- CALIBRATION STATE ---
const calibration = {
    phase: 'REST',          // 'REST' | 'ACTION' | 'DONE'
    timer: 10000,           // ms remaining in current phase
    restSamples: [],        // raw ADC values collected at rest
    actionSamples: [],      // raw ADC values collected during action
    waveform: new Array(60).fill(0), // last 60 throttled readings for display
    noiseFloor: 0,          // computed after REST phase
    peakAvg: 0,             // computed after ACTION phase
    threshold: 1,           // final threshold sent to backend
    sensorDetected: false,  // true once a sensor_raw event is received
    resultTimer: 0,         // countdown for result display (ms)
    lastWaveformUpdate: 0,  // timestamp of last waveform push
    skipTriggered: false,   // true once user presses Space to skip
};

// Audio System
let audioCtx = null;
let tensionOsc = null;
let tensionGain = null;
let lastPulseTime = 0;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function updateAudio(deltaTime) {
    if (!audioCtx) return;
    
    // Tension Bass Pulse
    if (gameState === STATES.WAITING_FOR_ACTION || gameState === STATES.HAZARD_SLOWMO) {
        const progress = timerValue / timerMax;
        const pulseInterval = 200 + (progress * 800); // 0.2s to 1s
        const now = Date.now();
        
        if (now - lastPulseTime > pulseInterval) {
            lastPulseTime = now;
            playSynthSound('tension_thud');
        }
    }
}

function playSynthSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'success') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'heavy_drop') {
        // Multi-layered Ka-Chunk
        osc.type = 'square';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);

        const click = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        click.type = 'sawtooth';
        click.frequency.setValueAtTime(1200, now);
        click.connect(clickGain);
        clickGain.connect(audioCtx.destination);
        clickGain.gain.setValueAtTime(0.1, now);
        clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        click.start(now); click.stop(now + 0.05);
    } else if (type === 'tension_thud') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'splash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    }
}

// Stickman Object
const stickman = {
    x: 140,
    y: CONFIG.GROUND_Y,
    width: 20,
    height: CONFIG.STICKMAN_HEIGHT,
    legAngle: 0,
    armAngle: 0,
    backArmAngle: 0,
    leanAngle: 0,
    rotation: 0,
    yOffset: 0,
    direction: 1,
    armState: 'IDLE',
    isDucking: false,
    dodgeType: 'DUCK',
    isDead: false,
    lastAfterImageTime: 0,
    
    updateAnimation(isMoving, deltaTime) {
        if (this.isDead) return;
        
        const lvl = LEVELS[currentLevelIdx];
        const isRunning = lvl.speed > 2.5;
        const isClimbing = gameState === STATES.CLIMBING;
        
        const baseFreq = 0.006; 
        const speedMult = isRunning ? 1.8 : 1.0;
        const time = Date.now() * baseFreq * speedMult;
        const swingAmp = isRunning ? 0.9 : 0.6;

        if (isClimbing) {
            this.yOffset = 0;
            this.leanAngle = 0;
            this.legAngle = Math.sin(time * 2) * 0.8;
            this.armAngle = Math.cos(time * 2) * 0.8;
            this.backArmAngle = -Math.cos(time * 2) * 0.8;
            return;
        }

        this.rotation = 0;

        if (isMoving) {
            this.yOffset = Math.abs(Math.sin(time * 2)) * -5; // Bobbing motion
            this.legAngle = Math.sin(time) * swingAmp;
            this.backArmAngle = Math.cos(time) * (swingAmp * 0.7);
            this.armAngle = (this.armState === 'HOLDING') ? -0.5 : -Math.cos(time) * (swingAmp * 0.7);
            this.leanAngle = isRunning ? 0.3 : 0.1;

            if (isRunning && Math.random() > 0.7) {
                particles.push({ 
                    x: this.x - this.direction * 10, 
                    y: this.y, 
                    vx: -this.direction * 2, 
                    vy: -Math.random() * 2, 
                    size: 2, 
                    life: 400,
                    color: '#AAA'
                });
            }
        } else {
            this.yOffset = 0;
            this.leanAngle = 0;
            this.legAngle = 0;
            this.backArmAngle = 0.2;
            if (this.armState === 'REACHING') this.armAngle = -1.2;
            else if (this.armState === 'HOLDING') this.armAngle = -0.8;
            else this.armAngle = 0.2;
        }

        if (this.isDucking) {
            // Record holographic after-images: Fixed time intervals for distinct spacing
            const now = Date.now();
            if (now - this.lastAfterImageTime > 400 && afterImages.length < 3) {
                this.lastAfterImageTime = now;
                afterImages.push({
                    x: this.x - (this.direction * (afterImages.length + 1) * 85), // Widely spaced
                    y: this.y, 
                    yOffset: this.yOffset, 
                    rotation: this.rotation, 
                    leanAngle: this.leanAngle,
                    direction: this.direction,
                    legAngle: this.legAngle,
                    armAngle: this.armAngle,
                    backArmAngle: this.backArmAngle,
                    dodgeType: this.dodgeType,
                    life: 500,
                    color: afterImages.length === 0 ? '#00FFFF' : (afterImages.length === 1 ? '#FF00FF' : '#00FF99')
                });
            }

            const progress = 1 - (duckingTimer / CONFIG.DODGE_DURATION);
            if (this.dodgeType === 'BACK_BEND') {
                this.yOffset = Math.sin(progress * Math.PI) * 20; 
                this.legAngle = 0.8;
                this.armAngle = 1.2;
                this.backArmAngle = 1.2;
            } else {
                this.yOffset = 10;
                this.legAngle = 1.2;
                this.armAngle = 0.5;
                this.backArmAngle = 0.5;
            }
            return;
        }
    },

    draw(overrideCtx, alpha = 1.0) {
        if (this.isDead || gameState === STATES.VAN_DRIVEAWAY) return; // Player hidden in getaway
        const dCtx = overrideCtx || ctx;
        dCtx.save();
        
        const isJumpingState = gameState === STATES.JUMPING;
        const jumpProgress = isJumpingState ? (1 - successTextTimer / 1000) : 0;

        if (alpha < 1.0) {
            // Digital Hologram Visuals
            const flicker = 0.6 + Math.random() * 0.4;
            dCtx.globalAlpha = alpha * flicker;
            dCtx.strokeStyle = this.color || '#00FFFF';
            dCtx.fillStyle = this.color || '#00FFFF';
            dCtx.shadowBlur = 10;
            dCtx.shadowColor = this.color || '#00FFFF';
            if (Math.floor(Date.now() / 50) % 2 === 0) dCtx.globalAlpha *= 0.7;
        } else {
            // Disappears rapidly inside van: completely gone at 25% jump progress
            dCtx.globalAlpha = isJumpingState ? Math.max(0, 1 - jumpProgress * 4) : alpha;
            dCtx.strokeStyle = CONFIG.COLORS.STICKMAN;
            dCtx.fillStyle = CONFIG.COLORS.STICKMAN;
        }

        dCtx.translate(this.x, this.y + (this.yOffset || 0));
        
        const isClimbing = gameState === STATES.CLIMBING;
        if (!isClimbing) {
            const s = isJumpingState ? Math.max(0.01, 1 - jumpProgress) : 1;
            dCtx.scale(this.direction * s, s);
            dCtx.rotate(this.leanAngle + (this.rotation || 0));
        }

        dCtx.lineWidth = 4;
        dCtx.lineCap = 'round';

        const headSize = 16;
        const bodyHeight = 30;
        const drawY = (this.isDucking && this.dodgeType === 'DUCK') ? -25 : -this.height;

        if (this.isDucking && this.dodgeType === 'BACK_BEND') dCtx.rotate(-1.3);

        // 1. Head & Eye (Always White, Hide eye when climbing)
        dCtx.fillRect(-headSize / 2, drawY, headSize, headSize);
        if (!isClimbing) {
            dCtx.save();
            dCtx.fillStyle = CONFIG.COLORS.BG;
            dCtx.fillRect(4, drawY + 4, 4, 4);
            dCtx.restore();
        }

        // 2. Arms (Strict Context Isolation)
        dCtx.save();
        const armY = drawY + headSize + 5;
        if (isClimbing) {
            [-12, 12].forEach((sideX, i) => {
                const anim = (i === 0 ? this.armAngle : -this.armAngle);
                dCtx.beginPath();
                dCtx.moveTo(0, armY);
                const mX = sideX * 0.5, mY = armY - 5 + Math.sin(anim) * 5;
                dCtx.lineTo(mX, mY); dCtx.lineTo(sideX, armY - 10 + Math.sin(anim) * 10);
                dCtx.stroke();
            });
        } else {
            dCtx.beginPath(); dCtx.moveTo(0, armY); dCtx.lineTo(Math.sin(this.backArmAngle) * 20, armY + Math.cos(this.backArmAngle) * 20); dCtx.stroke();
            dCtx.beginPath(); dCtx.moveTo(0, armY);
            let hX, hY;
            if (this.armState === 'REACHING') { hX = 24; hY = armY; }
            else if (this.armState === 'HOLDING') { hX = 12; hY = drawY + headSize - 5; }
            else { hX = Math.sin(this.armAngle) * 20; hY = armY + Math.cos(this.armAngle) * 20; }
            dCtx.lineTo(hX, hY); dCtx.stroke();
            if (hasObject) {
                drawBattery(hX, hY - 5); 
            }
        }
        dCtx.restore();

        // 3. Body & Legs
        dCtx.fillRect(-4, drawY + headSize, 8, (this.isDucking && this.dodgeType === 'DUCK') ? 15 : bodyHeight);
        const lY = drawY + headSize + ((this.isDucking && this.dodgeType === 'DUCK') ? 15 : bodyHeight);
        if (isClimbing) {
            [-10, 10].forEach((sideX, i) => {
                const anim = (i === 0 ? this.legAngle : -this.legAngle);
                dCtx.beginPath(); dCtx.moveTo(0, lY);
                const mX = sideX * 0.5, mY = lY + 5 + Math.sin(anim) * 5;
                dCtx.lineTo(mX, mY); dCtx.lineTo(sideX, lY + 10 + Math.sin(anim) * 10);
                dCtx.stroke();
            });
        } else {
            dCtx.beginPath(); dCtx.moveTo(0, lY); dCtx.lineTo(Math.sin(this.legAngle) * 25, lY + 25); dCtx.stroke();
            dCtx.beginPath(); dCtx.moveTo(0, lY); dCtx.lineTo(-Math.sin(this.legAngle) * 25, lY + 25); dCtx.stroke();
        }

        dCtx.restore();
    }
};

// Asset Drawing Helpers
function drawVanInterior(x, y) {
    ctx.save();
    ctx.fillStyle = '#111'; // Dark cargo area
    ctx.fillRect(x - 20, y - 70, 70, 50); 
    ctx.restore();
}

function drawVanExterior(x, y) {
    ctx.save();
    ctx.fillStyle = '#333'; ctx.fillRect(x - 60, y - 80, 120, 70); // Body
    ctx.fillStyle = '#222'; ctx.fillRect(x - 60, y - 40, 40, 30); // Cab
    ctx.fillStyle = '#555'; ctx.fillRect(x - 50, y - 70, 30, 20); ctx.fillRect(x - 10, y - 70, 60, 20); 
    ctx.fillStyle = '#111'; 
    ctx.beginPath(); ctx.arc(x - 40, y - 10, 15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 40, y - 10, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#AAA'; ctx.fillRect(x - 62, y - 35, 5, 20);
    ctx.fillStyle = '#FF0'; ctx.fillRect(x - 62, y - 30, 5, 5);
    ctx.restore();
}

function drawBackground(cX, cY) {
    const lvl = LEVELS[currentLevelIdx] || LEVELS[0];
    const theme = lvl.theme || 'CITY';
    
    if (theme === 'CITY') {
        ctx.save();
        const scrollX = Math.floor(cX * 0.3);
        const scrollY = Math.floor(cY * 0.2);
        ctx.fillStyle = '#222';
        for (let i = -1; i < 7; i++) {
            const x = Math.floor(i * 200 - (scrollX % 1200));
            ctx.fillRect(x, 200 - scrollY, 120, 300);
            ctx.fillStyle = '#333';
            ctx.fillRect(x + 20, 250 - scrollY, 20, 20);
            ctx.fillRect(x + 80, 250 - scrollY, 20, 20);
            ctx.fillStyle = '#222';
        }
        ctx.restore();
    } else if (theme === 'MOUNTAINS') {
        ctx.save();
        // Starfield
        ctx.fillStyle = '#fff';
        for(let i=0; i<50; i++) {
            let sx = (i * 137.5) % canvas.width;
            let sy = (i * 91.1) % 250;
            ctx.globalAlpha = 0.3 + (Math.sin(Date.now()*0.001 + i)*0.2);
            ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1.0;

        const layers = [
            { speed: 0.1, color: '#0a1a0a', peakHeight: 100, freq: 0.002, offset: 250 },
            { speed: 0.2, color: '#1a2a1a', peakHeight: 60, freq: 0.005, offset: 300 },
            { speed: 0.3, color: '#2a3a2a', peakHeight: 30, freq: 0.01, offset: 350 }
        ];
        layers.forEach(l => {
            ctx.fillStyle = l.color;
            ctx.beginPath();
            ctx.moveTo(0, canvas.height);
            for (let x = 0; x <= canvas.width; x += 20) {
                const worldX = x + cX * l.speed;
                // Jagged procedural peaks
                const noise = Math.sin(worldX * l.freq) * l.peakHeight + Math.sin(worldX * l.freq * 2.5) * (l.peakHeight * 0.3);
                const y = l.offset + noise;
                ctx.lineTo(x, y);
                // Sharp peaks
                if (x % 40 === 0) ctx.lineTo(x + 10, y - 15);
            }
            ctx.lineTo(canvas.width, canvas.height);
            ctx.fill();
        });
        ctx.restore();
    } else if (theme === 'TRAIN') {
        ctx.save();
        // Distant Snowy Mountains
        const mtScroll = cX * 0.05;
        ctx.fillStyle = '#1a1a2e';
        for (let i = -1; i < 5; i++) {
            const bx = (i * 400) - (mtScroll % 1600);
            ctx.beginPath();
            ctx.moveTo(bx, 380); ctx.lineTo(bx + 200, 100); ctx.lineTo(bx + 400, 380);
            ctx.fill();
            // Snow tips
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(bx + 150, 170); ctx.lineTo(bx + 200, 100); ctx.lineTo(bx + 250, 170);
            ctx.lineTo(bx + 225, 150); ctx.lineTo(bx + 200, 170); ctx.lineTo(bx + 175, 150);
            ctx.fill();
            ctx.fillStyle = '#1a1a2e';
        }

        // Rolling Hills
        const hillScroll = cX * 0.15;
        ctx.fillStyle = '#0d2b0d';
        for (let i = -1; i < 6; i++) {
            const hx = (i * 300) - (hillScroll % 1800);
            ctx.beginPath();
            ctx.ellipse(hx + 150, 380, 200, 100, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        const scrollX = cX * 0.8;
        // Motion Blurred Poles
        for (let i = -1; i < 15; i++) {
            const x = (i * 150) - (scrollX % 150);
            ctx.fillStyle = '#111';
            ctx.fillRect(x, 50, 6, 330);
            ctx.fillStyle = '#222'; ctx.fillRect(x - 8, 80, 22, 12);
        }
        // Distant blurred landscape
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 300, canvas.width, 80);
        ctx.restore();
    }
}

function drawGround(cX, cY) {
    const lvl = LEVELS[currentLevelIdx] || LEVELS[0];
    const theme = lvl.theme || 'CITY';
    ctx.save();
    
    if (theme === 'TRAIN') {
        // Detailed Red Train Cars
        const carWidth = 600;
        const gap = 20;
        const shakeX = Math.sin(Date.now() * 0.05) * 2; // Rapid shaking
        const shakeY = Math.cos(Date.now() * 0.07) * 1.5;

        for (let i = -2; i < 8; i++) {
            const x = i * (carWidth + gap) - cX + shakeX;
            const y = 380 - cY + shakeY;
            
            // 1. Car Main Body (Side View)
            ctx.fillStyle = CONFIG.COLORS.TRAIN_RED;
            ctx.fillRect(x, y, carWidth, 45);
            
            // 2. Panel Details
            ctx.fillStyle = '#990000'; // Darker red for panels
            for(let p=0; p<4; p++) {
                ctx.fillRect(x + 10 + p*150, y + 5, 140, 35);
            }

            // 3. Windows
            ctx.fillStyle = '#111';
            for(let w=0; w<4; w++) {
                ctx.fillRect(x + 40 + w*150, y + 10, 80, 20);
                // Glass shine
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(x + 40 + w*150, y + 10, 40, 10);
                ctx.fillStyle = '#111';
            }

            // 4. Mechanical Under-carriage
            ctx.fillStyle = '#222';
            ctx.fillRect(x + 20, y + 45, carWidth - 40, 10);
            // Wheels (simplified for retro feel)
            for(let wh=0; wh<6; wh++) {
                ctx.fillRect(x + 50 + wh*100, y + 50, 30, 5);
            }

            // 5. Steam/Mechanical parts
            ctx.fillStyle = '#444';
            ctx.fillRect(x + 10, y - 5, 40, 10); // Steam pipe
            
            // 6. Coupling
            ctx.fillStyle = '#111';
            ctx.fillRect(x + carWidth, y + 30, gap, 8);
        }

        // Special Station Rendering (Steam Vents/Crates)
        lvl.stations.forEach(s => {
            const sx = s.x - cX + shakeX;
            const sy = s.y - cY + shakeY;
            if (s.type === 'STEAM_VENT') {
                ctx.fillStyle = '#555';
                ctx.fillRect(sx - 20, sy - 5, 40, 5);
                if (Math.random() > 0.6) {
                    particles.push({ 
                        x: s.x + (Math.random()-0.5)*10, 
                        y: s.y, 
                        vx: (Math.random()-0.5)*2, 
                        vy: -2 - Math.random()*3, 
                        size: 4 + Math.random()*6, 
                        life: 800, 
                        color: 'rgba(200,200,200,0.4)' 
                    });
                }
            } else if (s.type === 'CONVEYOR') {
                ctx.fillStyle = '#444'; ctx.fillRect(sx - 40, sy - 20, 80, 20);
                ctx.fillStyle = '#222'; ctx.fillRect(sx - 35, sy - 15, 70, 10);
            }
        });
    } else {
        // Standard Ground
        ctx.strokeStyle = theme === 'MOUNTAINS' ? '#1a3a1a' : '#222';
        ctx.lineWidth = 4;
        [380, 200].forEach(y => {
            ctx.beginPath();
            ctx.moveTo(cX - 100 - cX, y - cY);
            ctx.lineTo(cX + canvas.width + 100 - cX, y - cY);
            ctx.stroke();
        });
        if (theme === 'MOUNTAINS') {
            ctx.fillStyle = '#1a3a1a';
            ctx.fillRect(-100, 382 - cY, canvas.width + 200, 100);
        }
    }
    
    // Improved Puddles (City Rain)
    if (lvl.weather === 'RAIN' && theme === 'CITY') {
        const puddlePositions = [200, 450, 700, 1000, 1300];
        puddlePositions.forEach(px => {
            const screenX = px - cX;
            // Draw puddle base - more irregular organic shape
            ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
            ctx.beginPath();
            ctx.ellipse(screenX, 380 - cY, 45, 10, 0, 0, Math.PI * 2);
            ctx.ellipse(screenX + 10, 382 - cY, 30, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Reflection Glow
            ctx.shadowBlur = 15; ctx.shadowColor = '#00FFCC';
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Splash check
            if (gameState === STATES.WALKING && Math.abs(stickman.x - px) < 40) {
                if (Math.random() > 0.8) {
                    particles.push({ 
                        x: stickman.x, 
                        y: 380, 
                        vx: (Math.random() - 0.5) * 4, 
                        vy: -Math.random() * 5, 
                        size: 2, 
                        life: 300, 
                        color: '#00FFCC' 
                    });
                    playSynthSound('splash');
                }
            }
        });

        // Draw Ripples
        puddleRipples.forEach(r => {
            ctx.strokeStyle = `rgba(0, 255, 204, ${r.alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(r.x - cX, r.y - cY, r.r, r.r * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
    }
    
    ctx.restore();
}

function drawTable(x, y) {
    ctx.save();
    ctx.fillStyle = '#8B4513'; ctx.fillRect(x - 40, y - 30, 80, 10);
    ctx.fillRect(x - 35, y - 20, 8, 20); ctx.fillRect(x + 27, y - 20, 8, 20);
    ctx.restore();
}

function drawBatteryHolder(x, y) {
    ctx.save();
    ctx.fillStyle = '#666'; ctx.fillRect(x - 15, y - 40, 30, 10);
    ctx.fillRect(x - 15, y - 60, 6, 20); ctx.fillRect(x + 9, y - 60, 6, 20);
    ctx.restore();
}

function drawBattery(x, y) {
    ctx.save();
    ctx.fillStyle = '#444'; ctx.fillRect(x - 6, y - 12, 12, 20);
    ctx.fillStyle = '#FF0'; ctx.fillRect(x - 4, y - 16, 8, 4);
    ctx.restore();
}

// Input Handling
let lastInputTime = 0;
const socket = io();

socket.on('vibration', (data) => {
    console.log("!!! HARDWARE ACTION RECEIVED !!!");
    processInput();
});

// Raw sensor stream used exclusively by the calibration scene
socket.on('sensor_raw', (data) => {
    if (gameState !== STATES.CALIBRATION) return;
    calibration.sensorDetected = true;
    const val = data.value;
    const now = Date.now();
    // Throttle waveform display to ~20Hz
    if (now - calibration.lastWaveformUpdate >= 50) {
        calibration.waveform.push(val);
        if (calibration.waveform.length > 60) calibration.waveform.shift();
        calibration.lastWaveformUpdate = now;
    }
    // Collect raw samples per phase
    if (calibration.phase === 'REST') {
        calibration.restSamples.push(val);
    } else if (calibration.phase === 'ACTION') {
        calibration.actionSamples.push(val);
    }
});

function processInput() {
    const now = Date.now();
    // Debounce aligned with ESP32 500ms cooldown + small buffer
    if (now - lastInputTime < 450) return; 
    lastInputTime = now;
    handleInput();
}

window.addEventListener('keydown', (e) => { if (e.code === 'Space') processInput(); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && gameState === STATES.CALIBRATION) { initAudio(); skipCalibration(); } });
window.addEventListener('touchstart', (e) => { e.preventDefault(); processInput(); }, { passive: false });

canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
    mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
});
canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    handleMenuClick(
        (e.clientX - r.left) * (canvas.width  / r.width),
        (e.clientY - r.top)  * (canvas.height / r.height)
    );
});

function handleInput() {
    initAudio(); // Initialize on first interaction
    // STORE / LEVEL_SELECT are mouse-driven; EMG/Space does nothing there
    if (gameState === STATES.STORE || gameState === STATES.LEVEL_SELECT) return;
    if (gameState === STATES.MENU) { currentLevelIdx = 0; initLevel(0); return; }
    if (gameState === STATES.GAME_OVER) {
        currentLevelIdx = 0; score = 0; combo = 0;
        initLevel(0); return;
    }
    if (gameState === STATES.LEVEL_COMPLETE) {
        // Unlock next level and return to main menu
        const nextIdx = Math.min(currentLevelIdx + 1, LEVELS.length - 1);
        maxUnlockedLevel = Math.max(maxUnlockedLevel, nextIdx);
        gameState = STATES.MENU; return;
    }

    if (gameState === STATES.WAITING_FOR_ACTION || gameState === STATES.HAZARD_SLOWMO) {
        const task = (hazardObj && hazardObj.tempTask) ? hazardObj.tempTask : LEVELS[currentLevelIdx].tasks[currentTaskIdx];
        
        // COMBO TIMING LOGIC: Only increment combo if within the perfect green window
        const progress = timerValue / timerMax;
        const isPerfect = progress >= CONFIG.COMBO_WINDOW[0] && progress <= CONFIG.COMBO_WINDOW[1];
        if (isPerfect) {
            combo++;
        } else {
            combo = 0; // Reset combo if timed poorly
        }

        if (task.type === ACTIONS.GRAB) {
            hasObject = true; stickman.armState = 'HOLDING'; 
            score += 10 * Math.max(1, combo); triggerSuccess(); playSynthSound('success');
        } else if (task.type === ACTIONS.DROP) {
            hasObject = false; stickman.armState = 'IDLE'; 
            score += 20 * Math.max(1, combo); shakeTimer = 300;
            const station = LEVELS[currentLevelIdx].stations.find(s => s.type === 'BASE' && Math.abs(s.x - stickman.x) < 80);
            droppedItems.push({ x: station ? station.x : stickman.x, y: stickman.y }); 
            triggerSuccess(); playSynthSound('heavy_drop');
        } else if (task.type === ACTIONS.DODGE) {
            stickman.isDucking = true; 
            stickman.dodgeType = (hazardObj && (hazardObj.type === 'BULLET' || (task.hazard === 'RANDOM' && Math.random() > 0.5))) ? 'BACK_BEND' : 'DUCK';
            duckingTimer = CONFIG.DODGE_DURATION; 
            score += 15 * Math.max(1, combo); playSynthSound('hit');
            if (hazardObj) {
                hazardObj.hasBeenDodged = true;
                timeScale = 2.0; setTimeout(() => { timeScale = 1.0; }, 500);
            }
        } else if (task.type === ACTIONS.CLIMB_UP || task.type === ACTIONS.CLIMB_DOWN) {
            gameState = STATES.CLIMBING; score += 10 * Math.max(1, combo); playSynthSound('success');
        } else if (task.type === ACTIONS.JUMP_IN_VAN) {
            gameState = STATES.JUMPING; successTextTimer = 1000; stickman.yOffset = 0; 
            score += 50 * Math.max(1, combo); playSynthSound('jump');
        }
    } else if (gameState === STATES.WALKING) {
        triggerGameOver("WRONG TIMING!");
    }
}

function triggerSuccess() {
    gameState = STATES.SUCCESS_TEXT;
    successTextTimer = 1000;
    currentTaskIdx++;
}

function initLevel(idx) {
    const lvl = LEVELS[idx];
    stickman.x = lvl.startPos;
    stickman.y = lvl.startY || CONFIG.GROUND_Y;
    stickman.direction = lvl.direction || 1;
    stickman.armState = lvl.initialHasObject ? 'HOLDING' : 'IDLE';
    stickman.isDucking = false;
    stickman.isDead = false;
    stickman.yOffset = 0;
    stickman.rotation = 0;
    hasObject = lvl.initialHasObject || false;
    currentTaskIdx = 0;
    gameState = STATES.WALKING;
    hazardObj = null;
    particles = [];
    weatherParticles = [];
    afterImages = [];
    nextHazardSpawnTime = Date.now() + 2000;
    cameraX = stickman.x - canvas.width / 2;
    cameraY = stickman.y - canvas.height + 100;
    droppedItems = [];

    if (idx === 4) {
        const van = lvl.stations.find(s => s.type === 'VAN');
        if (van) { van.x = 80; if (lvl.tasks[3]) lvl.tasks[3].x = van.x + 60; }
    }
}

function triggerGameOver(reason) {
    gameState = STATES.GAME_OVER; message = reason; messageColor = CONFIG.COLORS.FAIL;
    createExplosion(stickman.x, stickman.y - 30); stickman.isDead = true;
    combo = 0; playSynthSound('fail');
}

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        const color = Math.random() > 0.5 ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.FAIL;
        particles.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, size: Math.random() * 6 + 2, life: 1200, color: color });
    }
}

function spawnContinuousHazard(type) {
    const spawnX = stickman.direction === 1 ? cameraX + canvas.width + 100 : cameraX - 100;
    const timerRange = [2.3, 4.3];
    hazardObj = {
        x: spawnX, y: stickman.y - 45, type: type, vx: stickman.direction === 1 ? -6 : 6,
        tempTask: { type: ACTIONS.DODGE, label: "DODGE!", timer: timerRange }
    };
    gameState = STATES.WAITING_FOR_ACTION;
    timerMax = (Math.random() * (timerRange[1] - timerRange[0]) + timerRange[0]) * 1000 * reactionMultiplier;
    timerValue = timerMax;
}

function startTaskTimer(task) {
    timerMax = (Math.random() * (task.timer[1] - task.timer[0]) + task.timer[0]) * 1000 * reactionMultiplier;
    timerValue = timerMax;
    if (task.type === ACTIONS.GRAB || task.type === ACTIONS.DROP) stickman.armState = 'REACHING';
    if (task.hazard) {
        const hType = task.hazard === 'RANDOM' ? (Math.random() > 0.5 ? 'CAN' : 'BULLET') : task.hazard;
        const spawnX = stickman.direction === 1 ? cameraX + canvas.width + 100 : cameraX - 100;
        hazardObj = { x: spawnX, y: task.y - 45, type: hType, vx: stickman.direction === 1 ? -6 : 6 };
    }
    gameState = STATES.WAITING_FOR_ACTION;
}

// ---------------------------------------------------------------------------
// CALIBRATION LOGIC
// ---------------------------------------------------------------------------

function computeCalibrationResults() {
    const rest = calibration.restSamples;
    const action = calibration.actionSamples;

    // No sensor ever fired - leave backend threshold as-is, just show defaults on screen
    if (!calibration.sensorDetected || (rest.length === 0 && action.length === 0)) {
        calibration.noiseFloor = 0;
        calibration.peakAvg = 0;
        calibration.threshold = 1;
        console.log('[CAL] No sensor data - backend threshold unchanged');
        return;
    }


    // Noise floor = mean of all resting samples
    let noiseFloor = 1;
    if (rest.length > 0) {
        noiseFloor = rest.reduce((a, b) => a + b, 0) / rest.length;
    }

    // Peak avg = mean of top-10% action samples
    let peakAvg = noiseFloor + 10;
    if (action.length > 0) {
        const sorted = [...action].sort((a, b) => b - a);
        const topN = Math.max(1, Math.floor(sorted.length * 0.1));
        peakAvg = sorted.slice(0, topN).reduce((a, b) => a + b, 0) / topN;
    }

    // Threshold = 30% of the way from noise floor to peak
    const threshold = Math.max(1, Math.round(noiseFloor + 0.3 * (peakAvg - noiseFloor)));
    calibration.noiseFloor = Math.round(noiseFloor * 10) / 10;
    calibration.peakAvg    = Math.round(peakAvg    * 10) / 10;
    calibration.threshold  = threshold;

    socket.emit('set_calibration', { threshold, noise_floor: calibration.noiseFloor });
    console.log(`[CAL] Noise:${calibration.noiseFloor}  Peak:${calibration.peakAvg}  Threshold:${threshold}`);
}

function skipCalibration() {
    calibration.skipTriggered = true;
    // Compute with whatever data we have, or fall back to defaults
    computeCalibrationResults();
    gameState = STATES.MENU;
}

function updateCalibration(deltaTime) {
    if (calibration.phase === 'DONE') {
        calibration.resultTimer -= deltaTime;
        if (calibration.resultTimer <= 0) gameState = STATES.MENU;
        return;
    }
    calibration.timer -= deltaTime;
    if (calibration.timer <= 0) {
        if (calibration.phase === 'REST') {
            // Pre-compute noiseFloor (mean) so it shows as a reference line during ACTION
            if (calibration.restSamples.length > 0) {
                calibration.noiseFloor = calibration.restSamples.reduce((a, b) => a + b, 0) / calibration.restSamples.length;
            }
            calibration.phase = 'ACTION';
            calibration.timer = 10000;
            playSynthSound('success');
        } else {
            computeCalibrationResults();
            calibration.phase = 'DONE';
            calibration.resultTimer = 2500;
            playSynthSound('success');
        }
    }
}

function drawCalibration() {
    const W = canvas.width, H = canvas.height;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Subtle scan-line grid
    ctx.strokeStyle = 'rgba(0,255,204,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // ---- DONE overlay ----
    if (calibration.phase === 'DONE') {
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.shadowBlur = 24; ctx.shadowColor = '#00FFCC';
        ctx.fillStyle = '#00FFCC';
        ctx.font = '20px "Press Start 2P"';
        ctx.fillText('CALIBRATION', W / 2, 168);
        ctx.fillText('COMPLETE!', W / 2, 204);
        ctx.shadowBlur = 0;
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = '#666';
        ctx.fillText('NOISE FLOOR : ' + calibration.noiseFloor, W / 2, 258);
        ctx.fillText('PEAK SIGNAL : ' + calibration.peakAvg,    W / 2, 280);
        ctx.fillStyle = calibration.sensorDetected ? '#00FF88' : '#888';
        ctx.fillText('THRESHOLD SET TO : ' + calibration.threshold, W / 2, 312);
        if (!calibration.sensorDetected) {
            ctx.fillStyle = '#FF5500';
            ctx.font = '7px "Press Start 2P"';
            ctx.fillText('NO SENSOR DETECTED  --  DEFAULTS APPLIED', W / 2, 358);
        }
        return;
    }

    const phaseColor = calibration.phase === 'REST' ? '#00FFCC' : '#00FF88';

    // ---- Header ----
    ctx.textAlign = 'center';
    ctx.shadowBlur = 14; ctx.shadowColor = '#00FFCC';
    ctx.fillStyle = '#00FFCC';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('PIXEL FLEX', W / 2, 36);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#555';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('SYSTEM CALIBRATION', W / 2, 57);

    // Phase label
    const phaseLabel = calibration.phase === 'REST'
        ? 'PHASE 1 / 2    RESTING'
        : 'PHASE 2 / 2    ACTION';
    ctx.fillStyle = phaseColor;
    ctx.font = '9px "Press Start 2P"';
    ctx.fillText(phaseLabel, W / 2, 80);

    // Divider
    ctx.strokeStyle = phaseColor + '44';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 90); ctx.lineTo(W - 60, 90); ctx.stroke();

    // ---- Main instruction ----
    ctx.fillStyle = '#FFF';
    ctx.font = '14px "Press Start 2P"';
    if (calibration.phase === 'REST') {
        ctx.fillText('REST YOUR HAND', W / 2, 130);
        ctx.fillText('FLAT ON TABLE', W / 2, 157);
        ctx.fillStyle = '#666';
        ctx.font = '7px "Press Start 2P"';
        ctx.fillText('Place your forearm flat on the table surface.', W / 2, 185);
        ctx.fillText('Keep completely still and relaxed.', W / 2, 200);
    } else {
        ctx.fillText('LIFT HAND UP', W / 2, 130);
        ctx.fillText('PERPENDICULAR', W / 2, 157);
        ctx.fillStyle = '#666';
        ctx.font = '7px "Press Start 2P"';
        ctx.fillText('Raise your hand straight up from the table.', W / 2, 185);
        ctx.fillText('Flex your muscle firmly as you lift it.', W / 2, 200);
    }

    // ---- Sensor status dot ----
    const dotColor = calibration.sensorDetected ? '#00FF88' : '#FF3300';
    const dotLabel = calibration.sensorDetected ? 'SENSOR: ACTIVE' : 'NO SENSOR DETECTED';
    ctx.fillStyle = dotColor;
    // Pulse glow on the dot
    ctx.shadowBlur = calibration.sensorDetected ? 8 : 0;
    ctx.shadowColor = dotColor;
    ctx.beginPath();
    ctx.arc(W / 2 - 68, 219, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(dotLabel, W / 2 - 58, 223);
    ctx.textAlign = 'center';

    // ---- Progress bar ----
    const BAR_W = 460, BAR_H = 18;
    const bx = (W - BAR_W) / 2, by = 246;
    const pct = Math.max(0, calibration.timer / 10000);
    const remSec = Math.max(0, calibration.timer / 1000).toFixed(1);
    ctx.fillStyle = '#444';
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText(remSec + 's  REMAINING', W / 2, by - 7);
    // Track
    ctx.fillStyle = '#111';
    ctx.fillRect(bx, by, BAR_W, BAR_H);
    ctx.strokeStyle = phaseColor + '55';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, BAR_W, BAR_H);
    // Fill
    ctx.fillStyle = phaseColor;
    ctx.shadowBlur = 8; ctx.shadowColor = phaseColor;
    ctx.fillRect(bx, by, BAR_W * pct, BAR_H);
    ctx.shadowBlur = 0;

    // ---- Live waveform ----
    const WX = bx, WY = 290, WW = BAR_W, WH = 82;
    ctx.fillStyle = '#080808';
    ctx.fillRect(WX, WY, WW, WH);
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 1;
    ctx.strokeRect(WX, WY, WW, WH);
    ctx.fillStyle = '#2a2a2a';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE SIGNAL', WX + 5, WY + 11);
    ctx.textAlign = 'center';

    // Bars
    const wdata = calibration.waveform;
    const maxV = Math.max(1, ...wdata);
    const bw = WW / wdata.length;
    wdata.forEach((v, i) => {
        const h = Math.max(1, (v / maxV) * (WH - 16));
        const bxw = WX + i * bw;
        const byw = WY + WH - h;
        const alpha = 0.35 + (v / maxV) * 0.65;
        ctx.fillStyle = calibration.phase === 'REST'
            ? `rgba(0,200,204,${alpha})`
            : `rgba(0,255,120,${alpha})`;
        ctx.fillRect(bxw, byw, Math.max(1, bw - 1), h);
    });

    // Noise floor reference line during ACTION phase
    if (calibration.phase === 'ACTION' && calibration.noiseFloor > 0) {
        const nfPct = calibration.noiseFloor / maxV;
        const nfY = WY + WH - nfPct * (WH - 16);
        if (nfY > WY && nfY < WY + WH) {
            ctx.strokeStyle = 'rgba(255,140,0,0.7)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(WX, nfY); ctx.lineTo(WX + WW, nfY); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,140,0,0.8)';
            ctx.font = '6px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillText('NOISE', WX + 3, nfY - 2);
            ctx.textAlign = 'center';
        }
    }

    // ---- Footer ----
    ctx.fillStyle = '#2a2a2a';
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText('[ F ]  SKIP CALIBRATION', W / 2, 400);

    // Blinking hardware warning
    if (!calibration.sensorDetected) {
        const blink = Math.floor(Date.now() / 600) % 2 === 0;
        ctx.fillStyle = blink ? '#FF3300' : '#661100';
        ctx.font = '7px "Press Start 2P"';
        ctx.fillText('! HARDWARE NOT DETECTED  --  CONNECT ESP32 !', W / 2, 422);
    }

    // Sample counter (faint debug info)
    const sampleCount = calibration.phase === 'REST' ? calibration.restSamples.length : calibration.actionSamples.length;
    ctx.fillStyle = '#1e1e1e';
    ctx.font = '6px "Press Start 2P"';
    ctx.fillText('SAMPLES: ' + sampleCount, W / 2, 455);
}

// ---------------------------------------------------------------------------
// MAIN GAME LOOP UPDATE
// ---------------------------------------------------------------------------

function update(deltaTime) {
    if (gameState === STATES.CALIBRATION) { updateCalibration(deltaTime); return; }
    if (gameState === STATES.MENU || gameState === STATES.STORE || gameState === STATES.LEVEL_SELECT) {
        menuAnimTime += deltaTime; return;
    }
    if (gameState === STATES.GAME_OVER || gameState === STATES.LEVEL_COMPLETE) return;
    const effectiveDt = deltaTime * timeScale;

    if (stickman.isDucking) {
        duckingTimer -= effectiveDt;
        if (duckingTimer <= 0) { stickman.isDucking = false; stickman.yOffset = 0; afterImages = []; }
    }
    if (shakeTimer > 0) shakeTimer -= deltaTime;
    
    // Particles Update
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= deltaTime; });
    particles = particles.filter(p => p.life > 0);
    
    // Weather Update
    const lvl = LEVELS[currentLevelIdx];
    if (lvl.weather === 'RAIN') {
        if (Math.random() > 0.2) {
            weatherParticles.push({
                x: cameraX + Math.random() * (canvas.width + 400),
                y: cameraY - 20,
                vx: -2,
                vy: 10 + Math.random() * 5,
                life: 2000
            });
        }
    }
    weatherParticles.forEach(p => { 
        p.x += p.vx; p.y += p.vy; p.life -= deltaTime; 
        if (p.y >= 380 && p.life > 0) {
            const puddlePositions = [200, 450, 700, 1000, 1300];
            const hitPuddle = puddlePositions.find(px => Math.abs(p.x - px) < 45);
            if (hitPuddle) {
                puddleRipples.push({ x: p.x, y: 380, r: 2, alpha: 0.5 });
            }
            p.life = 0;
        }
    });
    weatherParticles = weatherParticles.filter(p => p.life > 0 && p.y < 500);

    puddleRipples.forEach(r => { r.r += 0.8 * (deltaTime / 16); r.alpha -= 0.02 * (deltaTime / 16); });
    puddleRipples = puddleRipples.filter(r => r.alpha > 0);

    afterImages.forEach(img => { img.life -= deltaTime; });
    afterImages = afterImages.filter(img => img.life > 0);

    if (lvl.continuousHazards && !hazardObj && gameState === STATES.WALKING) {
        if (Date.now() > nextHazardSpawnTime) { spawnContinuousHazard(lvl.continuousHazards); nextHazardSpawnTime = Date.now() + 1500; }
    }

    if (currentLevelIdx === 4 && gameState === STATES.WALKING && currentTaskIdx === 3) {
        const van = lvl.stations.find(s => s.type === 'VAN');
        if (van) { van.x -= 1.2 * (deltaTime / 16); lvl.tasks[3].x = van.x + 60; }
    }

    if (hazardObj) {
        let hSpeedMult = 1.0;
        const dist = Math.abs(hazardObj.x - stickman.x);
        const yDist = Math.abs(hazardObj.y - (stickman.y - 40));
        if (hazardObj.type === 'BULLET' && !hazardObj.hasBeenDodged) {
            if (dist < 150 && dist > 30 && yDist < 50) hSpeedMult = 0.1;
        }
        if (hazardObj.hasBeenDodged) hSpeedMult = 3.0;
        hazardObj.x += hazardObj.vx * (effectiveDt / 16) * hSpeedMult;
        if (!stickman.isDucking && dist < 25 && yDist < 30) triggerGameOver("BOOM! FAILED");
        if (hazardObj.hasBeenDodged && Math.abs(hazardObj.x - stickman.x) > 50) {
            if (gameState === STATES.WAITING_FOR_ACTION || gameState === STATES.HAZARD_SLOWMO) {
                if (hazardObj.tempTask) gameState = STATES.WALKING; else triggerSuccess();
            }
        }
        if (hazardObj && (hazardObj.x < cameraX - 200 || hazardObj.x > cameraX + canvas.width + 200)) hazardObj = null;
    }

    if (gameState === STATES.SUCCESS_TEXT) {
        successTextTimer -= deltaTime;
        if (successTextTimer <= 0) {
            gameState = STATES.WALKING;
            if (currentLevelIdx === 0 || currentLevelIdx === 4) {
                if (currentTaskIdx === 1) stickman.direction = -1;
            }
        }
    }

    if (gameState === STATES.WALKING || gameState === STATES.SUCCESS_TEXT) {
        if (gameState === STATES.WALKING) { stickman.updateAnimation(true, effectiveDt); stickman.x += lvl.speed * stickman.direction * (effectiveDt / 16); }
        if (currentTaskIdx >= lvl.tasks.length) {
            const endX = lvl.endX !== undefined ? lvl.endX : (stickman.direction === -1 ? -200 : cameraX + canvas.width + 200);
            if ((stickman.direction === 1 && stickman.x >= endX) || (stickman.direction === -1 && stickman.x <= endX)) {
                if (gameState !== STATES.SUCCESS_TEXT) { gameState = STATES.LEVEL_COMPLETE; message = "LEVEL COMPLETE!"; }
            }
        } else {
            const nextTask = lvl.tasks[currentTaskIdx];
            if (Math.abs(stickman.x - nextTask.x) < 10 && Math.abs(stickman.y - nextTask.y) < 10) { stickman.x = nextTask.x; stickman.y = nextTask.y; startTaskTimer(nextTask); }
        }
    } else if (gameState === STATES.CLIMBING) {
        stickman.updateAnimation(false, effectiveDt);
        const task = lvl.tasks[currentTaskIdx];
        const dir = task.targetY < stickman.y ? -1 : 1;
        stickman.y += dir * 2 * (effectiveDt / 16);
        if (Math.abs(stickman.y - task.targetY) < 5) { stickman.y = task.targetY; triggerSuccess(); }
    } else if (gameState === STATES.JUMPING) {
        successTextTimer -= effectiveDt;
        const progress = 1 - (successTextTimer / 1000);
        
        // End of level jump (e.g. into Van)
        const van = lvl.stations.find(s => s.type === 'VAN');
        const targetX = van ? van.x + 20 : stickman.x - 100;
        stickman.x += (targetX - stickman.x) * 0.04;
        stickman.yOffset = -Math.sin(progress * Math.PI) * 160;
        stickman.y += (380 - stickman.y) * 0.04; 

        if (successTextTimer <= 0) {
            if (currentLevelIdx === 4) { gameState = STATES.VAN_DRIVEAWAY; successTextTimer = 2500; }
            else { gameState = STATES.LEVEL_COMPLETE; message = "MISSION ACCOMPLISHED!"; }
        }
    } else if (gameState === STATES.VAN_DRIVEAWAY) {
        successTextTimer -= effectiveDt;
        const van = lvl.stations.find(s => s.type === 'VAN');
        if (van) {
            van.x -= 6 * (effectiveDt / 16);
            if (Math.random() > 0.4) {
                particles.push({ x: van.x + 40, y: van.y - 15, vx: 2 + Math.random() * 2, vy: -1 - Math.random() * 2, size: 4 + Math.random() * 8, life: 1000, color: '#666' });
                particles.push({ x: van.x + 30, y: van.y, vx: 1 + Math.random() * 3, vy: -Math.random() * 1.5, size: 2 + Math.random() * 4, life: 600, color: '#887755' });
            }
        }
        if (successTextTimer <= 0) { gameState = STATES.LEVEL_COMPLETE; message = "MISSION ACCOMPLISHED!"; }
    } else if (gameState === STATES.WAITING_FOR_ACTION || gameState === STATES.HAZARD_SLOWMO) {
        stickman.updateAnimation(false, effectiveDt);
        timerValue -= effectiveDt;
        if (timerValue <= 0 && !stickman.isDucking) triggerGameOver("TOO LATE!");
    }
    const targetCameraX = stickman.x - canvas.width / 2;
    const targetCameraY = stickman.y - canvas.height + 100;
    cameraX += (targetCameraX - cameraX) * 0.1;
    cameraY += (targetCameraY - cameraY) * 0.1;
}

function draw() {
    if (gameState === STATES.CALIBRATION)  { drawCalibration();  return; }
    if (gameState === STATES.MENU)         { drawMainMenu();      return; }
    if (gameState === STATES.STORE)        { drawStore();         return; }
    if (gameState === STATES.LEVEL_SELECT) { drawLevelSelect();   return; }
    const lvl = LEVELS[currentLevelIdx] || LEVELS[0];
    ctx.fillStyle = CONFIG.COLORS.BG; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background (Thematic)
    drawBackground(cameraX, cameraY);
    
    // Midground Parallax
    drawParallaxLayer(cameraX, cameraY, 0.1, '#111', 300, 150);
    drawParallaxLayer(cameraX, cameraY, 0.2, '#1a1a1a', 250, 120);

    ctx.save();
    if (shakeTimer > 0) ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
    
    // Ground (Thematic)
    drawGround(cameraX, cameraY);
    
    ctx.translate(-cameraX, -cameraY);
    
    // Weather Splashes
    if (lvl.weather === 'RAIN') {
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
        ctx.lineWidth = 1;
        weatherParticles.forEach(p => {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2); ctx.stroke();
            if (p.y >= 380) {
                if (Math.random() > 0.8) {
                    particles.push({ x: p.x, y: 380, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, size: 1, life: 200, color: 'rgba(255,255,255,0.5)' });
                }
            }
        });
    }

    lvl.stations.forEach(s => {
        if (s.type === 'BASE') { drawTable(s.x, s.y); drawBatteryHolder(s.x, s.y); }
        else if (s.type === 'BATTERY' || s.type === 'CONVEYOR' || s.type === 'MONEY') { 
            drawTable(s.x, s.y); if (gameState !== STATES.MENU && !hasObject && currentTaskIdx === 0) drawBattery(s.x, s.y - 38);
        }
        else if (s.type === 'LADDER') {
            ctx.strokeStyle = '#555'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(s.x - 15, s.y); ctx.lineTo(s.x - 15, s.y - s.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(s.x + 15, s.y); ctx.lineTo(s.x + 15, s.y - s.height); ctx.stroke();
            for(let h = 0; h < s.height; h += 20) { ctx.beginPath(); ctx.moveTo(s.x - 15, s.y - h); ctx.lineTo(s.x + 15, s.y - h); ctx.stroke(); }
        }
    });
    const van = lvl.stations.find(s => s.type === 'VAN');
    if (van) drawVanInterior(van.x, van.y);
    droppedItems.forEach(item => { drawBattery(item.x, item.y - 48); });
    
    // Entities
    ctx.shadowBlur = 15;
    afterImages.forEach(img => { 
        ctx.shadowColor = img.color || '#00FFFF';
        const dummy = Object.assign({}, stickman, img); 
        stickman.draw.call(dummy, ctx, img.life / 600); 
    });
    
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    stickman.draw();
    
    if (van) drawVanExterior(van.x, van.y);
    if (hazardObj) {
        ctx.shadowColor = hazardObj.type === 'CAN' ? CONFIG.COLORS.HAZARD_CAN : CONFIG.COLORS.HAZARD_BULLET;
        ctx.fillStyle = hazardObj.type === 'CAN' ? CONFIG.COLORS.HAZARD_CAN : CONFIG.COLORS.HAZARD_BULLET;
        if (hazardObj.type === 'CAN') ctx.fillRect(hazardObj.x - 8, hazardObj.y - 8, 16, 16); else ctx.fillRect(hazardObj.x - 10, hazardObj.y - 2, 20, 5);
    }
    
    ctx.shadowBlur = 0;
    particles.forEach(p => { ctx.fillStyle = p.color || CONFIG.COLORS.FAIL; ctx.fillRect(p.x, p.y, p.size, p.size); });
    ctx.restore();

    // UI
    ctx.fillStyle = messageColor; ctx.font = '20px "Press Start 2P"'; ctx.textAlign = 'center';
    if (gameState === STATES.GAME_OVER || gameState === STATES.LEVEL_COMPLETE) {
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(gameState === STATES.LEVEL_COMPLETE ? 'PRESS SPACE FOR MENU' : 'PRESS SPACE TO RETRY', canvas.width / 2, canvas.height / 2 + 40);
    } else if (gameState === STATES.SUCCESS_TEXT) ctx.fillText("SUCCESS!", canvas.width / 2, canvas.height / 2);
    
    if (gameState !== STATES.MENU) {
        ctx.fillStyle = CONFIG.COLORS.PRIMARY; ctx.font = '12px "Press Start 2P"'; ctx.textAlign = 'left';
        ctx.fillText(lvl.name, 20, 30); 
        ctx.fillText(`SCORE: ${score}`, 20, 55);
        if (combo > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '16px "Press Start 2P"';
            ctx.fillText(`COMBO x${combo}`, 20, 85);
        }

        if (gameState === STATES.WAITING_FOR_ACTION || gameState === STATES.HAZARD_SLOWMO) {
            const task = (hazardObj && hazardObj.tempTask) ? hazardObj.tempTask : lvl.tasks[currentTaskIdx];
            ctx.textAlign = 'center'; const screenX = stickman.x - cameraX; ctx.fillText(task.label, screenX, stickman.y - 120);
            const barW = 100; const fillW = (timerValue / timerMax) * barW; 
            
            // Bar Background
            ctx.fillStyle = '#333'; ctx.fillRect(screenX - barW / 2, stickman.y - 110, barW, 10);
            
            // Perfect Window (Green Section)
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            const winX = barW * (1 - CONFIG.COMBO_WINDOW[1]);
            const winW = barW * (CONFIG.COMBO_WINDOW[1] - CONFIG.COMBO_WINDOW[0]);
            ctx.fillRect(screenX - barW / 2 + winX, stickman.y - 110, winW, 10);

            // Active Fill
            const progress = timerValue / timerMax;
            const isPerfect = progress >= CONFIG.COMBO_WINDOW[0] && progress <= CONFIG.COMBO_WINDOW[1];
            ctx.fillStyle = isPerfect ? CONFIG.COLORS.PERFECT : ((timerValue < 1000) ? CONFIG.COLORS.FAIL : CONFIG.COLORS.PRIMARY); 
            ctx.fillRect(screenX - barW / 2, stickman.y - 110, fillW, 10);
        }
    }
}

function drawParallaxLayer(cX, cY, speed, color, height, spacing) {
    ctx.save();
    ctx.fillStyle = color;
    const scrollX = cX * speed;
    for (let i = -2; i < 10; i++) {
        const x = i * spacing - (scrollX % spacing);
        ctx.fillRect(x, canvas.height - height - (cY * speed * 0.5), spacing * 0.6, height);
    }
    ctx.restore();
}


// =========================================================================
//  MENU SYSTEM — Night City, Skin Shop, Level Select
// =========================================================================

function isHovering(x, y, w, h) {
    return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
}

function drawPixelButton(label, x, y, w, h, hov, accent) {
    accent = accent || '#00FFCC';
    ctx.save();
    ctx.shadowBlur = hov ? 14 : 0;
    ctx.shadowColor = accent;
    ctx.fillStyle = hov ? '#233233' : '#111c1c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hov ? accent : '#2a4040';
    ctx.lineWidth = hov ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = hov ? accent : '#4a7070';
    ctx.font = '9px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function drawMenuBackButton(x, y, hov) {
    ctx.save();
    ctx.shadowBlur = hov ? 10 : 0;
    ctx.shadowColor = '#00FFCC';
    ctx.fillStyle = hov ? '#00FFCC' : '#1a5555';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText('< BACK >', x, y);
    if (hov) {
        // Decorative corner dots
        ctx.fillRect(x - 10, y - 8, 3, 3);
        ctx.fillRect(x - 10, y - 2, 3, 3);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawNightCity(W, H, t, purple) {
    // Sky gradient
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    if (purple) {
        sky.addColorStop(0, '#04000d');
        sky.addColorStop(1, '#150828');
    } else {
        sky.addColorStop(0, '#010510');
        sky.addColorStop(1, '#061428');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.ceil(H * 0.72) + 2);

    // Stars
    for (var i = 0; i < 55; i++) {
        var sx = (i * 139 + 23) % W;
        var sy = (i * 103 + 11) % Math.floor(H * 0.55);
        var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0009 + i * 0.42));
        ctx.fillStyle = 'rgba(255,255,255,' + tw.toFixed(2) + ')';
        ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    for (var j = 0; j < 7; j++) {
        var asx = (j * 91 + 60) % W;
        var asy = (j * 73 + 10) % Math.floor(H * 0.38);
        var atw = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.001 + j * 1.2));
        ctx.fillStyle = j % 2 === 0
            ? 'rgba(255,80,200,' + atw.toFixed(2) + ')'
            : 'rgba(80,255,255,' + atw.toFixed(2) + ')';
        ctx.fillRect(asx, asy, 2, 2);
    }

    // Far city silhouette layer
    ctx.fillStyle = purple ? '#0c0520' : '#04101c';
    for (var k = 0; k < 14; k++) {
        var fbx = ((k * 52 + 9)  % (W + 40)) - 5;
        var fbh = 70 + (k * 41   % 90);
        var fbw = 26 + (k * 17   % 22);
        ctx.fillRect(fbx, H * 0.52 - fbh, fbw, fbh + 4);
        if (k % 4 === 0) {
            ctx.fillRect(fbx + fbw / 2 - 1, H * 0.52 - fbh - 14, 2, 14);
            var blink = Math.sin(t * 0.002 + k) > 0;
            ctx.fillStyle = blink ? 'rgba(255,50,50,0.9)' : 'rgba(80,0,0,0.5)';
            ctx.beginPath();
            ctx.arc(fbx + fbw / 2, H * 0.52 - fbh - 15, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = purple ? '#0c0520' : '#04101c';
        }
    }

    // Mid city layer with windows
    for (var m = 0; m < 9; m++) {
        var mbx = ((m * 73 + 18) % (W + 30)) - 5;
        var mbw = 48 + (m * 23   % 38);
        var mbh = 110 + (m * 53  % 120);
        var mby = H * 0.72 - mbh;
        ctx.fillStyle = purple ? '#160830' : '#0b1e2e';
        ctx.fillRect(mbx, mby, mbw, mbh);
        var cols = Math.floor(mbw / 14);
        var rows = Math.floor(mbh / 16);
        for (var wr = 0; wr < rows; wr++) {
            for (var wc2 = 0; wc2 < cols; wc2++) {
                var ws = (m * 7 + wr * 3 + wc2 * 5) % 9;
                var lit = ws < 5;
                var wColor;
                if (lit) {
                    if (purple) wColor = ws < 2 ? '#5010a0' : ws < 4 ? '#284cb0' : '#dda020';
                    else        wColor = ws < 2 ? '#004090' : ws < 4 ? '#c06000' : '#dddd20';
                } else {
                    wColor = purple ? '#090418' : '#030e18';
                }
                ctx.fillStyle = wColor;
                ctx.fillRect(mbx + 4 + wc2 * 13, mby + 10 + wr * 15, 9, 10);
            }
        }
    }

    // Neon signs
    _neonSign(W * 0.37, H * 0.48, 'PIXEL\nFLEX', '#FF40CC', t);
    _neonSign(W * 0.56, H * 0.42, purple ? '\u63d0\u6c14' : 'EMG', '#00DDFF', t);
    if (purple) _neonSign(W * 0.76, H * 0.43, 'OUT', '#FF4488', t);

    // Ground
    var groundY = Math.floor(H * 0.72);
    if (purple) {
        ctx.fillStyle = '#0f0a07';
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 7;
        for (var fl = 0; fl < 5; fl++) {
            ctx.beginPath();
            ctx.moveTo(0, groundY + fl * 18);
            ctx.lineTo(W, groundY + fl * 18);
            ctx.stroke();
        }
    } else {
        ctx.fillStyle = '#181c20';
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.fillStyle = '#22262a';
        ctx.fillRect(0, groundY + 10, Math.floor(W * 0.38), H - groundY - 10);
        var railX = Math.floor(W * 0.58);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(railX, groundY); ctx.lineTo(W, groundY); ctx.stroke();
        for (var rp = railX; rp <= W; rp += 38) {
            ctx.beginPath(); ctx.moveTo(rp, groundY); ctx.lineTo(rp, groundY + 48); ctx.stroke();
        }
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(railX, groundY + 22); ctx.lineTo(W, groundY + 22); ctx.stroke();
        ctx.fillStyle = '#262b30';
        ctx.fillRect(W - 68, groundY + 38, 68, 12);
        ctx.fillRect(W - 50, groundY + 28, 50, 10);
    }
}

function _neonSign(x, y, text, color, t) {
    var flicker = 0.78 + 0.22 * Math.abs(Math.sin(t * 0.003 + x * 0.01));
    var lines = text.split('\n');
    ctx.save();
    ctx.shadowBlur = Math.round(12 * flicker);
    ctx.shadowColor = color;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    var sw = 54, sh = lines.length > 1 ? 44 : 28;
    ctx.strokeRect(x - sw / 2, y - sh / 2, sw, sh);
    ctx.fillStyle = color;
    ctx.font = (lines.length > 1 ? '6px' : '8px') + ' "Press Start 2P"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach(function(line, li) {
        ctx.fillText(line, x, y + (li - (lines.length - 1) / 2) * 12);
    });
    ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function _drawShopSkin(x, y, scale, skinIdx, t) {
    var skin = SKINS[skinIdx];
    var c = skin.bodyColor, g = skin.glowColor;
    ctx.save();
    ctx.translate(x, y); ctx.scale(scale, scale);
    var bob = Math.sin(t * 0.002) * 2;
    if (skin.armor || skinIdx === 1) { ctx.shadowBlur = 10; ctx.shadowColor = g; }
    ctx.strokeStyle = c; ctx.fillStyle = c;
    ctx.lineWidth = skin.armor ? 4 : 2.5; ctx.lineCap = 'round';
    // Head
    ctx.beginPath(); ctx.arc(0, -62 + bob, 9, 0, Math.PI * 2);
    skin.armor ? ctx.fill() : ctx.stroke();
    // Body
    ctx.beginPath(); ctx.moveTo(0, -53 + bob); ctx.lineTo(0, -22 + bob); ctx.stroke();
    // Arms
    ctx.beginPath(); ctx.moveTo(0, -42 + bob); ctx.lineTo(-17, -27 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -42 + bob); ctx.lineTo( 17, -27 + bob); ctx.stroke();
    // Legs
    ctx.beginPath(); ctx.moveTo(0, -22 + bob); ctx.lineTo(-12, 5 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -22 + bob); ctx.lineTo( 12, 5 + bob); ctx.stroke();
    // Cowboy hat
    if (skin.hat) {
        ctx.fillStyle = '#8B5E3C';
        ctx.fillRect(-15, -79 + bob, 30, 5);
        ctx.fillRect(-9,  -91 + bob, 18, 13);
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1;
        ctx.strokeRect(-15, -79 + bob, 30, 5);
    }
    // Ninja chest detail
    if (skin.armor) {
        ctx.shadowBlur = 0; ctx.strokeStyle = g; ctx.lineWidth = 1;
        ctx.strokeRect(-7, -52 + bob, 14, 18);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

function _drawSittingStickman(x, y, t) {
    var bob = Math.sin(t * 0.0015) * 1.5;
    ctx.save();
    ctx.strokeStyle = '#FFFFFF'; ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.shadowBlur = 5; ctx.shadowColor = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y - 58 + bob, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 49 + bob); ctx.lineTo(x - 4, y - 22 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3, y - 40 + bob); ctx.lineTo(x - 18, y - 30 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3, y - 40 + bob); ctx.lineTo(x + 13,  y - 28 + bob); ctx.stroke();
    // Sitting legs
    ctx.beginPath(); ctx.moveTo(x - 4, y - 22 + bob); ctx.lineTo(x - 18, y - 22 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, y - 22 + bob); ctx.lineTo(x + 12,  y - 22 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 18, y - 22 + bob); ctx.lineTo(x - 18, y + 2 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 12,  y - 22 + bob); ctx.lineTo(x + 12,  y + 2 + bob); ctx.stroke();
    ctx.shadowBlur = 0;
    // Stool
    ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 22, y - 14 + bob); ctx.lineTo(x + 18, y - 14 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 20, y - 14 + bob); ctx.lineTo(x - 20, y + 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 16,  y - 14 + bob); ctx.lineTo(x + 16,  y + 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 20, y + 4 + bob); ctx.lineTo(x + 16, y + 4 + bob); ctx.stroke();
    ctx.restore();
}

function _drawHoloPlatform(x, y, t) {
    ctx.save();
    var pulse = 0.7 + 0.3 * Math.sin(t * 0.003);
    ctx.shadowColor = '#00FFCC';
    for (var pi = 3; pi >= 0; pi--) {
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(0,255,210,' + ((0.85 - pi * 0.15) * pulse).toFixed(2) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y + pi * 5, 72 + pi * 8, 14 + pi * 5, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,255,200,' + (0.04 * pulse).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(x - 28, y); ctx.lineTo(x - 58, y - 115);
    ctx.lineTo(x + 58, y - 115); ctx.lineTo(x + 28, y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
}

function _drawLockIcon(x, y, unlocked) {
    ctx.save();
    ctx.fillStyle   = unlocked ? '#22aa44' : '#882222';
    ctx.strokeStyle = unlocked ? '#44cc66' : '#aa3333';
    ctx.lineWidth = 2;
    ctx.fillRect(x - 7, y - 1, 14, 11);
    ctx.strokeRect(x - 7, y - 1, 14, 11);
    ctx.beginPath();
    if (unlocked) ctx.arc(x - 2, y - 4, 6, Math.PI * 1.15, Math.PI * 2);
    else          ctx.arc(x,     y - 4, 6, Math.PI,         Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = unlocked ? '#44cc66' : '#cc4444';
    ctx.beginPath(); ctx.arc(x, y + 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// --- DRAW MAIN MENU ---
function drawMainMenu() {
    var W = canvas.width, H = canvas.height, t = menuAnimTime;
    drawNightCity(W, H, t, false);

    // Sitting stickman
    _drawSittingStickman(200, 340, t);

    // Plant decorations
    ctx.fillStyle = '#1a3a10'; ctx.fillRect(258, 352, 10, 16);
    ctx.fillStyle = '#2a5a18';
    ctx.beginPath(); ctx.arc(262, 346, 9,  0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(270, 343, 6,  0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e4a14';
    ctx.beginPath(); ctx.arc(254, 349, 5,  0, Math.PI * 2); ctx.fill();

    // Title "[PIXEL FLEX]" with glitch effect
    ctx.textAlign = 'center';
    var glitch = Math.sin(t * 0.0013) > 0.96;
    if (glitch) {
        ctx.fillStyle = '#FF00CC'; ctx.font = '22px "Press Start 2P"';
        ctx.fillText('[PIXEL FLEX]', W / 2 + 3, 62);
    }
    ctx.shadowBlur = 20; ctx.shadowColor = '#00FFCC';
    ctx.fillStyle = '#00FFCC'; ctx.font = '22px "Press Start 2P"';
    ctx.fillText('[PIXEL FLEX]', W / 2, 60);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#234433'; ctx.font = '6px "Press Start 2P"';
    ctx.fillText('EMG-CONTROLLED STICKMAN GAME', W / 2, 78);

    // Right-side buttons  (4 stacked: CALIBRATE / PLAY / STORE / LEVELS)
    var BX = 476, BW = 138, BH = 30;
    var hCal    = isHovering(BX, 118, BW, BH);
    var hPlay   = isHovering(BX, 158, BW, BH);
    var hStore  = isHovering(BX, 198, BW, BH);
    var hLevels = isHovering(BX, 238, BW, BH);
    drawPixelButton('CALIBRATE', BX, 118, BW, BH, hCal, '#FF8800');
    drawPixelButton('PLAY',      BX, 158, BW, BH, hPlay);
    drawPixelButton('STORE',     BX, 198, BW, BH, hStore);
    drawPixelButton('LEVELS',    BX, 238, BW, BH, hLevels);

    canvas.style.cursor = (hCal || hPlay || hStore || hLevels) ? 'pointer' : 'default';

    // Footer
    ctx.fillStyle = '#1a2e1a'; ctx.font = '5px "Press Start 2P"'; ctx.textAlign = 'center';
    ctx.fillText('SPACE / EMG SENSOR = PLAY  \u2022  CLICK BUTTONS TO NAVIGATE', W / 2, 470);
}

// --- DRAW STORE ---
function drawStore() {
    var W = canvas.width, H = canvas.height, t = menuAnimTime;
    drawNightCity(W, H, t, true);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 16; ctx.shadowColor = '#00CCFF';
    ctx.fillStyle = '#00CCFF'; ctx.font = '17px "Press Start 2P"';
    ctx.fillText('[SKIN SHOP]', W / 2, 52);
    ctx.shadowBlur = 0;

    ctx.font = '7px "Press Start 2P"'; ctx.textAlign = 'right';
    ctx.fillStyle = '#336644';
    ctx.fillText('SCORE: ' + score, W - 16, 28);

    var bHov = isHovering(15, 10, 92, 24);
    drawMenuBackButton(22, 28, bHov);

    _drawHoloPlatform(W / 2, 355, t);

    var total = SKINS.length;
    var prev  = (selectedSkin - 1 + total) % total;
    var next  = (selectedSkin + 1) % total;
    ctx.globalAlpha = 0.42;
    _drawShopSkin(W / 2 - 152, 302, 1.1, prev, t);
    _drawShopSkin(W / 2 + 152, 302, 1.1, next, t);
    ctx.globalAlpha = 1;
    _drawShopSkin(W / 2, 300, 1.55, selectedSkin, t);

    var sc = SKINS[selectedSkin];
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10; ctx.shadowColor = sc.glowColor;
    ctx.fillStyle = sc.glowColor; ctx.font = '10px "Press Start 2P"';
    ctx.fillText(sc.name, W / 2, 393);
    ctx.shadowBlur = 0;

    var aLHov = isHovering(52, 243, 44, 44);
    var aRHov = isHovering(544, 243, 44, 44);
    ctx.font = '22px "Press Start 2P"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = aLHov ? 12 : 0; ctx.shadowColor = '#00FFCC';
    ctx.fillStyle = aLHov ? '#00FFCC' : '#2a5050';
    ctx.fillText('<', 74, 265);
    ctx.shadowBlur = aRHov ? 12 : 0;
    ctx.fillStyle = aRHov ? '#00FFCC' : '#2a5050';
    ctx.fillText('>', 566, 265);
    ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';

    var isOwned    = ownedSkins[selectedSkin];
    var isEquipped = currentActiveSkin === selectedSkin;
    var buyLabel   = isEquipped ? '[EQUIPPED]' : isOwned ? '[SELECT]' : '[BUY ' + sc.cost + ']';
    var buyColor   = isEquipped ? '#FFD700' : isOwned ? '#00FFCC' : '#FF8800';
    var bBuyHov    = isHovering(240, 418, 160, 36);
    drawPixelButton(buyLabel, 240, 418, 160, 36, bBuyHov, buyColor);

    canvas.style.cursor = (bHov || aLHov || aRHov || bBuyHov) ? 'pointer' : 'default';
}

// --- DRAW LEVEL SELECT ---
function drawLevelSelect() {
    var W = canvas.width, H = canvas.height, t = menuAnimTime;
    drawNightCity(W, H, t, true);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 14; ctx.shadowColor = '#00CCFF';
    ctx.fillStyle = '#00CCFF'; ctx.font = '14px "Press Start 2P"';
    ctx.fillText('[SELECT LEVELS]', W / 2, 50);
    ctx.shadowBlur = 0;

    var bHov = isHovering(15, 10, 92, 24);
    drawMenuBackButton(22, 28, bHov);

    // Connecting bezier paths
    ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
    for (var pi = 0; pi < LEVEL_NODES.length - 1; pi++) {
        var n1 = LEVEL_NODES[pi], n2 = LEVEL_NODES[pi + 1];
        var pathUnlocked = pi < maxUnlockedLevel;
        ctx.strokeStyle = pathUnlocked ? 'rgba(0,220,200,0.55)' : 'rgba(80,40,80,0.38)';
        var mx = (n1.x + n2.x) / 2;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.bezierCurveTo(mx, n1.y, mx, n2.y, n2.x, n2.y);
        ctx.stroke();
        if (pathUnlocked) {
            var dt = ((t * 0.0006 + pi * 0.25) % 1);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(0,255,200,0.85)';
            ctx.beginPath();
            ctx.arc(n1.x + (n2.x - n1.x) * dt, n1.y + (n2.y - n1.y) * dt, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([5, 5]);
        }
    }
    ctx.setLineDash([]);

    // Level node cards
    var CW = 76, CH = 58;
    var anyCardHov = false;
    for (var li = 0; li < LEVEL_NODES.length; li++) {
        var nd   = LEVEL_NODES[li];
        var cx   = nd.x - CW / 2, cy = nd.y - CH / 2;
        var unl  = li <= maxUnlockedLevel;
        var sel  = li === selectedLevelNode;
        var chov = isHovering(cx, cy, CW, CH);
        if (chov) anyCardHov = true;

        ctx.fillStyle = sel ? '#16263e' : chov ? '#121828' : '#0b1020';
        ctx.fillRect(cx, cy, CW, CH);

        ctx.shadowBlur = sel ? 10 : 0; ctx.shadowColor = '#00FFCC';
        ctx.strokeStyle = sel ? '#00FFCC' : unl ? '#1e3854' : '#1e1228';
        ctx.lineWidth = sel ? 2 : 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, CW - 1, CH - 1);
        ctx.shadowBlur = 0;

        // Mini preview
        ctx.fillStyle = LEVEL_NODE_COLORS[li] || '#101020';
        ctx.fillRect(cx + 3, cy + 3, CW - 6, CH - 22);

        // Level number (large, inside preview)
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText((li + 1).toString(), nd.x, nd.y - 5);

        // Label strip
        ctx.fillStyle = unl ? '#6a9aaa' : '#3a2040';
        ctx.font = '5px "Press Start 2P"';
        ctx.fillText('LVL ' + (li + 1), nd.x, nd.y + CH / 2 - 6);

        _drawLockIcon(nd.x + 26, cy + 13, unl);
    }

    // START LEVEL button
    var stUnl = selectedLevelNode <= maxUnlockedLevel;
    var sHov  = isHovering(232, 422, 176, 36) && stUnl;
    drawPixelButton(stUnl ? '[START LEVEL]' : '[LOCKED]', 232, 422, 176, 36, sHov, stUnl ? '#00FFCC' : '#993333');

    canvas.style.cursor = (anyCardHov || sHov || bHov) ? 'pointer' : 'default';
}

// --- MENU CLICK HANDLER ---
function handleMenuClick(cx, cy) {
    function hit(x, y, w, h) { return cx >= x && cx <= x + w && cy >= y && cy <= y + h; }
    initAudio();

    if (gameState === STATES.MENU) {
        var BX = 476, BW = 138, BH = 30;
        if (hit(BX, 118, BW, BH)) {
            // Reset calibration and enter calibration scene
            calibration.phase = 'REST';
            calibration.timer = 10000;
            calibration.restSamples = [];
            calibration.actionSamples = [];
            calibration.sensorDetected = false;
            calibration.skipTriggered = false;
            calibration.resultTimer = 0;
            gameState = STATES.CALIBRATION;
            return;
        }
        if (hit(BX, 158, BW, BH)) { currentLevelIdx = 0; initLevel(0); return; }  // PLAY
        if (hit(BX, 198, BW, BH)) { gameState = STATES.STORE; return; }             // STORE
        if (hit(BX, 238, BW, BH)) { gameState = STATES.LEVEL_SELECT; return; }      // LEVELS
    }

    if (gameState === STATES.STORE) {
        if (hit(15, 10, 92, 24))   { gameState = STATES.MENU; return; }
        if (hit(52, 243, 44, 44))  { selectedSkin = (selectedSkin - 1 + SKINS.length) % SKINS.length; playSynthSound('hit'); return; }
        if (hit(544, 243, 44, 44)) { selectedSkin = (selectedSkin + 1) % SKINS.length; playSynthSound('hit'); return; }
        if (hit(240, 418, 160, 36)) {
            if (ownedSkins[selectedSkin]) {
                currentActiveSkin = selectedSkin; playSynthSound('success');
            } else if (score >= SKINS[selectedSkin].cost) {
                score -= SKINS[selectedSkin].cost;
                ownedSkins[selectedSkin] = true;
                currentActiveSkin = selectedSkin; playSynthSound('success');
            } else {
                playSynthSound('fail');
            }
        }
    }

    if (gameState === STATES.LEVEL_SELECT) {
        if (hit(15, 10, 92, 24)) { gameState = STATES.MENU; return; }
        var CW2 = 76, CH2 = 58;
        for (var ni = 0; ni < LEVEL_NODES.length; ni++) {
            var nd2 = LEVEL_NODES[ni];
            if (hit(nd2.x - CW2 / 2, nd2.y - CH2 / 2, CW2, CH2)) {
                selectedLevelNode = ni; playSynthSound('hit'); return;
            }
        }
        if (hit(232, 422, 176, 36) && selectedLevelNode <= maxUnlockedLevel) {
            currentLevelIdx = selectedLevelNode;
            initLevel(selectedLevelNode);
        }
    }
}

function gameLoop(timestamp) {

    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    update(deltaTime || 16);
    updateAudio(deltaTime || 16);
    draw();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
