// ============================================================
// Fantasy Quest - Unicorn Adventure
// A side-scrolling adventure with Sparkle, Aurora & Todrick
// ============================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ---- Game State ----
let gameRunning = false;
let paused = false;
let score = 0;
let coins = 0;
let distance = 0;
let health = 100;
let currentMission = 0;
let activeCharIndex = 0;
let gameSpeed = 4;
let frameCount = 0;
let particles = [];
let shakeTimer = 0;
let invincibleTimer = 0;

// ---- Input ----
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ---- Missions ----
const missions = [
    { name: 'Cross the Enchanted Forest', distance: 2000, bg: 'forest', speed: 4 },
    { name: 'Race Through Crystal Caverns', distance: 2500, bg: 'cavern', speed: 5 },
    { name: 'Survive the Lava Mountains', distance: 3000, bg: 'lava', speed: 5.5 },
    { name: 'Storm the Shadow Castle', distance: 3500, bg: 'castle', speed: 6 },
    { name: 'Reach the Rainbow Summit', distance: 4000, bg: 'rainbow', speed: 6.5 },
];

// ---- Characters ----
const characters = [
    {
        name: 'Sparkle',
        type: 'unicorn',
        x: 120, y: 0, width: 50, height: 50,
        vy: 0, grounded: true, ducking: false,
        jumpPower: -14, doubleJump: true, hasDoubleJump: true,
        color: '#e0b0ff',
        ability: 'Double Jump',
    },
    {
        name: 'Aurora',
        type: 'princess',
        x: 120, y: 0, width: 55, height: 48,
        vy: 0, grounded: true, ducking: false,
        jumpPower: -12, speed: 2,
        color: '#ff69b4',
        ability: 'Speed Boost (car)',
    },
    {
        name: 'Todrick',
        type: 'mushroom',
        x: 120, y: 0, width: 40, height: 44,
        vy: 0, grounded: true, ducking: false,
        jumpPower: -16, small: true,
        color: '#ff6347',
        ability: 'Super Jump & Small Size',
    },
];

const GROUND_Y = 400;
const GRAVITY = 0.7;

// ---- Obstacles & Collectibles ----
let obstacles = [];
let collectibles = [];

const obstacleTypes = [
    { type: 'rock', width: 40, height: 40, color: '#6b7280' },
    { type: 'thorns', width: 60, height: 30, color: '#7c3aed' },
    { type: 'log', width: 70, height: 35, color: '#92400e' },
    { type: 'bat', width: 35, height: 30, color: '#4a0e4e', flying: true },
    { type: 'ghost', width: 38, height: 42, color: '#c8c8ff', flying: true },
    { type: 'fireball', width: 30, height: 30, color: '#ef4444', flying: true },
];

// ---- Background layers ----
let bgOffset = 0;
let bgStars = [];
for (let i = 0; i < 60; i++) {
    bgStars.push({ x: Math.random() * 900, y: Math.random() * 300, size: Math.random() * 2 + 0.5, speed: Math.random() * 0.3 + 0.1 });
}

// ---- Moon Phase ----
let moonPhase = 0; // 0-7: new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent
let moonPhaseTimer = 0;
const MOON_PHASE_INTERVAL = 600; // frames between phase changes (~10 seconds at 60fps)

function drawMoon() {
    const mx = 780, my = 70, r = 30;

    // Advance phase over time
    moonPhaseTimer++;
    if (moonPhaseTimer >= MOON_PHASE_INTERVAL) {
        moonPhaseTimer = 0;
        moonPhase = (moonPhase + 1) % 8;
    }

    ctx.save();

    // Glow behind the moon (stronger when fuller)
    const fullness = 1 - Math.abs(moonPhase - 4) / 4; // 0 at new, 1 at full
    const glowRadius = 40 + fullness * 25;
    const glowAlpha = 0.05 + fullness * 0.15;
    const glow = ctx.createRadialGradient(mx, my, r * 0.5, mx, my, glowRadius);
    glow.addColorStop(0, `rgba(200, 210, 255, ${glowAlpha})`);
    glow.addColorStop(1, 'rgba(200, 210, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Clip to moon circle
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.clip();

    // Draw the lit part of the moon (pale white/yellow)
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);

    // Draw craters on lit surface
    ctx.fillStyle = 'rgba(180, 170, 155, 0.4)';
    ctx.beginPath(); ctx.arc(mx - 8, my - 10, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 10, my + 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 3, my + 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 12, my - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 12, my + 4, 3.5, 0, Math.PI * 2); ctx.fill();

    // Shadow overlay to create the phase
    // Phase 0: new (fully dark), Phase 4: full (no shadow)
    const bg = missions[currentMission].bg;
    const shadowColor = getThemeColors(bg).sky1;

    if (moonPhase !== 4) { // not full moon
        ctx.fillStyle = shadowColor;

        if (moonPhase === 0) {
            // New moon: fully dark
            ctx.beginPath();
            ctx.arc(mx, my, r + 1, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // For other phases, use an ellipse to carve out the shadow
            // The terminator (shadow edge) is an ellipse whose x-radius varies
            // phase 1-3: shadow on left side shrinking (waxing)
            // phase 5-7: shadow on right side growing (waning)

            const t = moonPhase <= 4 ? moonPhase : 8 - moonPhase; // 0-4 symmetric
            const terminatorRx = r * Math.abs(1 - t / 2); // ellipse x-radius

            if (moonPhase < 4) {
                // Waxing: shadow on the left
                // Draw shadow as left half, then add/subtract terminator ellipse
                ctx.beginPath();
                ctx.arc(mx, my, r + 1, Math.PI * 0.5, Math.PI * 1.5); // left half arc
                if (moonPhase < 2) {
                    // Shadow covers more than half — terminator bulges right
                    ctx.ellipse(mx, my, terminatorRx, r, 0, -Math.PI * 0.5, Math.PI * 0.5);
                } else if (moonPhase === 2) {
                    // First quarter — exactly half
                    ctx.lineTo(mx, my - r);
                } else {
                    // Waxing gibbous — terminator indents left
                    ctx.ellipse(mx, my, terminatorRx, r, 0, Math.PI * 0.5, -Math.PI * 0.5, true);
                }
                ctx.fill();
            } else {
                // Waning: shadow on the right
                ctx.beginPath();
                ctx.arc(mx, my, r + 1, -Math.PI * 0.5, Math.PI * 0.5); // right half arc
                if (moonPhase > 6) {
                    // Shadow covers more than half — terminator bulges left
                    ctx.ellipse(mx, my, terminatorRx, r, 0, Math.PI * 0.5, -Math.PI * 0.5);
                } else if (moonPhase === 6) {
                    // Last quarter — exactly half
                    ctx.lineTo(mx, my - r);
                } else {
                    // Waning gibbous — terminator indents right
                    ctx.ellipse(mx, my, terminatorRx, r, 0, -Math.PI * 0.5, Math.PI * 0.5, true);
                }
                ctx.fill();
            }
        }
    }

    ctx.restore();
}

// ---- Drawing Functions ----

function getThemeColors(bg) {
    switch (bg) {
        case 'forest': return { sky1: '#0b1a0b', sky2: '#1a3a1a', ground: '#2d5a27', groundLine: '#3a7a33', accent: '#4ade80' };
        case 'cavern': return { sky1: '#0a0a2e', sky2: '#1a1a4e', ground: '#2a2a5a', groundLine: '#4444aa', accent: '#818cf8' };
        case 'lava': return { sky1: '#1a0000', sky2: '#3a1010', ground: '#4a2020', groundLine: '#8b3030', accent: '#f87171' };
        case 'castle': return { sky1: '#0a0a1a', sky2: '#1a1020', ground: '#2a2030', groundLine: '#4a3050', accent: '#c084fc' };
        case 'rainbow': return { sky1: '#1a0a2e', sky2: '#2a1a4e', ground: '#3a2a5e', groundLine: '#6a4a8e', accent: '#f0abfc' };
        default: return { sky1: '#0b1a0b', sky2: '#1a3a1a', ground: '#2d5a27', groundLine: '#3a7a33', accent: '#4ade80' };
    }
}

function drawBackground() {
    const theme = getThemeColors(missions[currentMission].bg);

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, theme.sky1);
    grad.addColorStop(1, theme.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, GROUND_Y);

    // Moon
    drawMoon();

    // Stars / particles
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    bgStars.forEach(s => {
        s.x -= s.speed * gameSpeed * 0.3;
        if (s.x < 0) { s.x = 900; s.y = Math.random() * 300; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Distant mountains/trees silhouette
    ctx.fillStyle = theme.sky2;
    for (let i = 0; i < 10; i++) {
        const bx = ((i * 120 - bgOffset * 0.2) % 1200 + 1200) % 1200 - 150;
        const bh = 60 + Math.sin(i * 2.5) * 40;
        ctx.beginPath();
        ctx.moveTo(bx, GROUND_Y);
        ctx.lineTo(bx + 60, GROUND_Y - bh);
        ctx.lineTo(bx + 120, GROUND_Y);
        ctx.fill();
    }

    // Mid-ground elements
    ctx.fillStyle = theme.ground + '80';
    for (let i = 0; i < 8; i++) {
        const tx = ((i * 150 - bgOffset * 0.5) % 1200 + 1200) % 1200 - 100;
        drawTree(tx, GROUND_Y, theme);
    }

    // Ground
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, GROUND_Y, 900, 100);
    ctx.fillStyle = theme.groundLine;
    ctx.fillRect(0, GROUND_Y, 900, 3);

    // Ground detail
    ctx.fillStyle = theme.groundLine + '60';
    for (let i = 0; i < 30; i++) {
        const gx = ((i * 35 - bgOffset) % 1050 + 1050) % 1050 - 50;
        ctx.fillRect(gx, GROUND_Y + 10 + (i % 3) * 15, 15, 2);
    }
}

function drawTree(x, baseY, theme) {
    if (missions[currentMission].bg === 'cavern') {
        // Stalactites
        ctx.fillStyle = theme.ground + '90';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 15, 80 + Math.sin(x) * 30);
        ctx.lineTo(x + 30, 0);
        ctx.fill();
    } else if (missions[currentMission].bg === 'lava') {
        // Lava pools glow
        ctx.fillStyle = '#ef444440';
        ctx.beginPath();
        ctx.ellipse(x + 20, baseY, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Trees
        ctx.fillStyle = '#1a3a1a80';
        ctx.fillRect(x + 15, baseY - 50, 8, 50);
        ctx.beginPath();
        ctx.arc(x + 19, baseY - 55, 22, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---- Character Rendering ----

function drawUnicorn(char) {
    const x = char.x, y = char.y;
    const bounce = Math.sin(frameCount * 0.15) * (char.grounded ? 2 : 0);
    const dy = char.ducking ? 15 : 0;

    ctx.save();
    ctx.translate(x, y + bounce + dy);

    // Body
    ctx.fillStyle = '#f0e0ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, char.ducking ? 10 : 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated)
    ctx.fillStyle = '#e0c8f0';
    const legAnim = Math.sin(frameCount * 0.2) * 5;
    ctx.fillRect(-14, 10 - dy, 6, char.ducking ? 5 : 14 + legAnim);
    ctx.fillRect(-4, 10 - dy, 6, char.ducking ? 5 : 14 - legAnim);
    ctx.fillRect(6, 10 - dy, 6, char.ducking ? 5 : 14 + legAnim);
    ctx.fillRect(14, 10 - dy, 6, char.ducking ? 5 : 14 - legAnim);

    // Head
    ctx.fillStyle = '#f5eaff';
    ctx.beginPath();
    ctx.arc(24, -10, 12, 0, Math.PI * 2);
    ctx.fill();

    // Horn (rainbow shimmer)
    const hornColor = `hsl(${(frameCount * 3) % 360}, 80%, 70%)`;
    ctx.fillStyle = hornColor;
    ctx.beginPath();
    ctx.moveTo(28, -22);
    ctx.lineTo(32, -40);
    ctx.lineTo(36, -22);
    ctx.fill();

    // Horn glow
    ctx.shadowColor = hornColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(32, -35, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eye
    ctx.fillStyle = '#6b21a8';
    ctx.beginPath();
    ctx.arc(30, -12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(31, -13, 1, 0, Math.PI * 2);
    ctx.fill();

    // Mane
    ctx.fillStyle = '#c084fc';
    for (let i = 0; i < 4; i++) {
        const mx = 10 - i * 8;
        const my = -18 + Math.sin(frameCount * 0.1 + i) * 3;
        ctx.beginPath();
        ctx.ellipse(mx, my, 6, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Tail
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.quadraticCurveTo(-35, -10 + Math.sin(frameCount * 0.12) * 8, -30, -20 + Math.sin(frameCount * 0.1) * 5);
    ctx.stroke();
    ctx.strokeStyle = '#d946ef';
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.quadraticCurveTo(-38, -5 + Math.sin(frameCount * 0.14) * 8, -34, -18 + Math.sin(frameCount * 0.12) * 5);
    ctx.stroke();

    // Sparkle effect when invincible
    if (invincibleTimer > 0) {
        ctx.fillStyle = `hsla(${frameCount * 10 % 360}, 100%, 80%, 0.6)`;
        for (let i = 0; i < 5; i++) {
            const sx = Math.cos(frameCount * 0.2 + i * 1.3) * 30;
            const sy = Math.sin(frameCount * 0.2 + i * 1.3) * 20;
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawPrincess(char) {
    const x = char.x, y = char.y;
    const bounce = Math.sin(frameCount * 0.15) * (char.grounded ? 1.5 : 0);

    ctx.save();
    ctx.translate(x, y + bounce);

    // Car body
    ctx.fillStyle = '#ec4899';
    roundRect(ctx, -28, 2, 56, 20, 5);
    ctx.fill();

    // Car top / windshield
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-15, 2);
    ctx.lineTo(-8, -12);
    ctx.lineTo(18, -12);
    ctx.lineTo(24, 2);
    ctx.fill();

    // Windshield glass
    ctx.fillStyle = '#93c5fd80';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-6, -10);
    ctx.lineTo(16, -10);
    ctx.lineTo(22, 0);
    ctx.fill();

    // Wheels (animated rotation)
    const wheelRot = frameCount * 0.3;
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(-16, 22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(-16, 22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 22, 4, 0, Math.PI * 2); ctx.fill();
    // Wheel spokes
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const a = wheelRot + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(-16 + Math.cos(a) * 3, 22 + Math.sin(a) * 3);
        ctx.lineTo(-16 + Math.cos(a) * 7, 22 + Math.sin(a) * 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(16 + Math.cos(a) * 3, 22 + Math.sin(a) * 3);
        ctx.lineTo(16 + Math.cos(a) * 7, 22 + Math.sin(a) * 7);
        ctx.stroke();
    }

    // Princess (sitting in car)
    // Head
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(4, -22, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(4, -26, 10, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-4, -28, 4, 12);

    // Crown
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-4, -32);
    ctx.lineTo(-2, -38);
    ctx.lineTo(2, -34);
    ctx.lineTo(6, -40);
    ctx.lineTo(10, -34);
    ctx.lineTo(12, -38);
    ctx.lineTo(14, -32);
    ctx.fill();

    // Crown gems
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(0, -35, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(6, -37, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath(); ctx.arc(12, -35, 2, 0, Math.PI * 2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e40af';
    ctx.beginPath(); ctx.arc(1, -22, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -22, 2, 0, Math.PI * 2); ctx.fill();

    // Smile
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(5, -19, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Car exhaust particles
    if (char.grounded) {
        ctx.fillStyle = 'rgba(150,150,150,0.3)';
        for (let i = 0; i < 3; i++) {
            const px = -30 - i * 8 - Math.random() * 5;
            const py = 15 + Math.sin(frameCount * 0.3 + i) * 5;
            ctx.beginPath();
            ctx.arc(px, py, 3 + i, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawMushroom(char) {
    const x = char.x, y = char.y;
    const bounce = Math.sin(frameCount * 0.18) * (char.grounded ? 2 : 0);
    const dy = char.ducking ? 10 : 0;

    ctx.save();
    ctx.translate(x, y + bounce + dy);

    const scale = char.ducking ? 0.7 : 1;
    ctx.scale(scale, scale);

    // Body / stem
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-8, 0, 16, char.ducking ? 10 : 18);

    // Feet
    ctx.fillStyle = '#92400e';
    const footAnim = Math.sin(frameCount * 0.2) * 3;
    ctx.fillRect(-12, (char.ducking ? 10 : 18), 10, 6 + footAnim);
    ctx.fillRect(2, (char.ducking ? 10 : 18), 10, 6 - footAnim);

    // Mushroom cap
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(0, -2, 20, 16, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -2, 20, 5, 0, 0, Math.PI);
    ctx.fill();

    // Cap spots (white)
    ctx.fillStyle = '#fef2f2';
    ctx.beginPath(); ctx.arc(-10, -10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -12, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-2, -16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -6, 3, 0, Math.PI * 2); ctx.fill();

    // Eyes (big and cute like Toad)
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-6, 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(-5, 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-4, 3, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 3, 1, 0, Math.PI * 2); ctx.fill();

    // Mouth (open happy)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(0, 9, 4, 0, Math.PI);
    ctx.fill();

    // Vest
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-8, 0, 16, 6);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-1, 0, 2, 6);

    ctx.restore();
}

function drawCharacter(char) {
    switch (char.type) {
        case 'unicorn': drawUnicorn(char); break;
        case 'princess': drawPrincess(char); break;
        case 'mushroom': drawMushroom(char); break;
    }
}

// ---- Obstacle Rendering ----

function drawObstacle(obs) {
    ctx.save();
    ctx.translate(obs.x, obs.y);

    switch (obs.type) {
        case 'rock':
            ctx.fillStyle = '#6b7280';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-20, 0);
            ctx.lineTo(-15, -30);
            ctx.lineTo(5, -38);
            ctx.lineTo(20, -28);
            ctx.lineTo(20, 0);
            ctx.fill();
            ctx.fillStyle = '#9ca3af';
            ctx.beginPath();
            ctx.moveTo(-10, -5);
            ctx.lineTo(-5, -20);
            ctx.lineTo(8, -15);
            ctx.lineTo(5, -3);
            ctx.fill();
            break;
        case 'thorns':
            ctx.fillStyle = '#581c87';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 12 - 24, 0);
                ctx.lineTo(i * 12 - 18, -25);
                ctx.lineTo(i * 12 - 12, 0);
                ctx.fill();
            }
            ctx.fillStyle = '#7c3aed';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 12 - 18, 0);
                ctx.lineTo(i * 12 - 12, -18);
                ctx.lineTo(i * 12 - 6, 0);
                ctx.fill();
            }
            break;
        case 'log':
            ctx.fillStyle = '#78350f';
            roundRect(ctx, -35, -15, 70, 30, 8);
            ctx.fill();
            ctx.strokeStyle = '#92400e';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(-25 + i * 20, -15);
                ctx.lineTo(-25 + i * 20, 15);
                ctx.stroke();
            }
            // Rings on end
            ctx.fillStyle = '#92400e';
            ctx.beginPath(); ctx.arc(-30, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#a16207';
            ctx.beginPath(); ctx.arc(-30, 0, 5, 0, Math.PI * 2); ctx.fill();
            break;
        case 'bat':
            const wingFlap = Math.sin(frameCount * 0.4) * 15;
            ctx.fillStyle = '#4a0e4e';
            // Wings
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-20, -wingFlap, -18, 5);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(20, -wingFlap, 18, 5);
            ctx.fill();
            // Body
            ctx.beginPath(); ctx.ellipse(0, 3, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
            // Eyes
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(-3, 0, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(3, 0, 2, 0, Math.PI * 2); ctx.fill();
            break;
        case 'ghost':
            const ghostFloat = Math.sin(frameCount * 0.08) * 5;
            ctx.translate(0, ghostFloat);
            ctx.fillStyle = 'rgba(200, 200, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(0, -10, 16, Math.PI, 0);
            ctx.lineTo(16, 10);
            for (let i = 0; i < 4; i++) {
                ctx.quadraticCurveTo(16 - i * 8 - 4, i % 2 === 0 ? 18 : 10, 16 - (i + 1) * 8, 10);
            }
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.ellipse(-5, -10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(5, -10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
            // Mouth
            ctx.beginPath(); ctx.ellipse(0, -2, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
            break;
        case 'fireball':
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f97316';
            ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            // Flames trailing
            ctx.fillStyle = '#ef444480';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(-16 - i * 8, Math.sin(frameCount * 0.3 + i) * 5, 6 - i, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
    }

    ctx.restore();
}

// ---- Collectibles ----

function drawCollectible(col) {
    ctx.save();
    ctx.translate(col.x, col.y);
    const bob = Math.sin(frameCount * 0.1 + col.x * 0.01) * 4;
    ctx.translate(0, bob);

    if (col.type === 'coin') {
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
    } else if (col.type === 'heart') {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.bezierCurveTo(-10, -6, -14, -12, 0, -16);
        ctx.bezierCurveTo(14, -12, 10, -6, 0, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
    } else if (col.type === 'star') {
        ctx.fillStyle = `hsl(${(frameCount * 5) % 360}, 80%, 70%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        drawStar(ctx, 0, 0, 5, 12, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
    }
    ctx.closePath();
}

// ---- Particles ----

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 30 + Math.random() * 20,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        p.size *= 0.97;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 50;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// ---- Utility ----

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// ---- Spawning ----

function spawnObstacle() {
    const mission = missions[currentMission];
    let available = obstacleTypes.filter(o => {
        if (mission.bg === 'forest' && o.type === 'fireball') return false;
        if (mission.bg === 'cavern' && o.type === 'log') return false;
        return true;
    });
    if (mission.bg === 'lava') available.push(obstacleTypes.find(o => o.type === 'fireball'));
    if (mission.bg === 'castle') available.push(obstacleTypes.find(o => o.type === 'ghost'));

    const tmpl = available[Math.floor(Math.random() * available.length)];
    const obs = { ...tmpl, x: 950 };
    if (obs.flying) {
        obs.y = GROUND_Y - 60 - Math.random() * 80;
    } else {
        obs.y = GROUND_Y;
    }
    obstacles.push(obs);
}

function spawnCollectible() {
    const types = ['coin', 'coin', 'coin', 'heart', 'star'];
    const type = types[Math.floor(Math.random() * types.length)];
    collectibles.push({
        type,
        x: 950,
        y: GROUND_Y - 30 - Math.random() * 100,
        width: 20,
        height: 20,
    });
}

// ---- Collision Detection ----

function checkCollision(a, b) {
    const ax = a.x - a.width / 2;
    const ay = a.y - a.height / 2;
    const bx = b.x - (b.width || 20) / 2;
    const by = b.y - (b.height || 20) / 2;
    return ax < bx + (b.width || 20) &&
           ax + a.width > bx &&
           ay < by + (b.height || 20) &&
           ay + a.height > by;
}

// ---- Game Logic ----

function update() {
    if (!gameRunning || paused) return;

    frameCount++;
    const char = characters[activeCharIndex];
    const mission = missions[currentMission];
    gameSpeed = mission.speed;

    // Character switching
    if (keys['ShiftLeft'] || keys['ShiftRight']) {
        if (!keys._shiftUsed) {
            keys._shiftUsed = true;
            activeCharIndex = (activeCharIndex + 1) % characters.length;
            const newChar = characters[activeCharIndex];
            newChar.x = char.x;
            newChar.y = char.y;
            newChar.vy = char.vy;
            newChar.grounded = char.grounded;
            spawnParticles(char.x, char.y, char.color, 15);
            document.getElementById('active-char').textContent = 'Active: ' + newChar.name;
        }
    } else {
        keys._shiftUsed = false;
    }

    // Pause
    if (keys['KeyP']) {
        if (!keys._pauseUsed) {
            keys._pauseUsed = true;
            paused = !paused;
        }
    } else {
        keys._pauseUsed = false;
    }

    // Movement
    if (keys['ArrowLeft'] || keys['KeyA']) {
        char.x = Math.max(40, char.x - 4);
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        char.x = Math.min(400, char.x + 4);
    }

    // Ducking
    char.ducking = (keys['ArrowDown'] || keys['KeyS']) && char.grounded;

    // Jumping
    if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
        if (!keys._jumpUsed) {
            keys._jumpUsed = true;
            if (char.grounded) {
                char.vy = char.jumpPower;
                char.grounded = false;
                if (char.type === 'unicorn') char.hasDoubleJump = true;
                spawnParticles(char.x, char.y + char.height / 2, '#ffffff', 5);
            } else if (char.type === 'unicorn' && char.hasDoubleJump) {
                char.vy = char.jumpPower * 0.85;
                char.hasDoubleJump = false;
                spawnParticles(char.x, char.y, '#c084fc', 10);
            }
        }
    } else {
        keys._jumpUsed = false;
    }

    // Physics
    if (!char.grounded) {
        char.vy += GRAVITY;
        char.y += char.vy;
    }

    // Ground collision
    const charBottom = GROUND_Y - char.height / 2 - (char.type === 'princess' ? 5 : 0);
    if (char.y >= charBottom) {
        char.y = charBottom;
        char.vy = 0;
        char.grounded = true;
    }

    // Invincibility
    if (invincibleTimer > 0) invincibleTimer--;

    // Companions (inactive characters follow)
    characters.forEach((c, i) => {
        if (i === activeCharIndex) return;
        const targetX = char.x - 50 - i * 35;
        const targetY = charBottom;
        c.x += (targetX - c.x) * 0.08;
        c.y += (targetY - c.y) * 0.1;
        c.grounded = true;
    });

    // Update distance & speed
    distance += gameSpeed * 0.5;
    bgOffset += gameSpeed;

    // Spawn obstacles
    if (frameCount % Math.max(40, 90 - currentMission * 10) === 0) {
        spawnObstacle();
    }
    // Spawn collectibles
    if (frameCount % 70 === 0) {
        spawnCollectible();
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;
        if (obstacles[i].x < -80) { obstacles.splice(i, 1); continue; }

        // Collision with active character
        const hitbox = { x: char.x, y: char.y, width: char.width * 0.7, height: char.ducking ? char.height * 0.5 : char.height * 0.7 };
        if (checkCollision(hitbox, obstacles[i]) && invincibleTimer <= 0) {
            health -= 20;
            invincibleTimer = 60;
            shakeTimer = 10;
            spawnParticles(char.x, char.y, '#ef4444', 12);
            obstacles.splice(i, 1);
            if (health <= 0) {
                gameOver();
                return;
            }
        }
    }

    // Update collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
        collectibles[i].x -= gameSpeed;
        if (collectibles[i].x < -30) { collectibles.splice(i, 1); continue; }

        const hitbox = { x: char.x, y: char.y, width: char.width, height: char.height };
        if (checkCollision(hitbox, collectibles[i])) {
            const col = collectibles[i];
            if (col.type === 'coin') {
                coins++;
                score += 10;
                spawnParticles(col.x, col.y, '#fbbf24', 8);
            } else if (col.type === 'heart') {
                health = Math.min(100, health + 20);
                spawnParticles(col.x, col.y, '#ef4444', 8);
            } else if (col.type === 'star') {
                score += 50;
                invincibleTimer = 180;
                spawnParticles(col.x, col.y, '#a855f7', 15);
            }
            collectibles.splice(i, 1);
        }
    }

    // Passive character trail particles
    if (frameCount % 5 === 0 && char.type === 'unicorn' && !char.grounded) {
        spawnParticles(char.x - 10, char.y + 10, '#c084fc', 1);
    }
    if (frameCount % 3 === 0 && char.type === 'princess' && char.grounded) {
        spawnParticles(char.x - 30, char.y + 20, '#9ca3af', 1);
    }

    updateParticles();

    // Score ticks
    if (frameCount % 10 === 0) score++;

    // Update HUD
    document.getElementById('health-fill').style.width = health + '%';
    document.getElementById('health-fill').style.background = health > 50 ? 'linear-gradient(90deg, #22c55e, #4ade80)' :
        health > 25 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)';
    document.getElementById('health-text').textContent = 'HP: ' + health + '/100';
    document.getElementById('score-display').textContent = 'Score: ' + score;
    document.getElementById('coins-display').textContent = 'Coins: ' + coins;
    document.getElementById('distance-display').textContent = 'Distance: ' + Math.floor(distance) + 'm';

    // Mission completion
    if (distance >= mission.distance) {
        missionComplete();
    }
}

function draw() {
    ctx.save();

    // Screen shake
    if (shakeTimer > 0) {
        ctx.translate(Math.random() * 6 - 3, Math.random() * 6 - 3);
        shakeTimer--;
    }

    drawBackground();

    // Draw collectibles
    collectibles.forEach(drawCollectible);

    // Draw obstacles
    obstacles.forEach(drawObstacle);

    // Draw companions first (behind active)
    characters.forEach((c, i) => {
        if (i !== activeCharIndex) {
            ctx.globalAlpha = 0.5;
            drawCharacter(c);
            ctx.globalAlpha = 1;
        }
    });

    // Draw active character
    drawCharacter(characters[activeCharIndex]);

    // Draw particles
    drawParticles();

    // Pause overlay
    if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 900, 500);
        ctx.fillStyle = '#f0c0ff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', 450, 250);
        ctx.font = '18px sans-serif';
        ctx.fillText('Press P to continue', 450, 290);
    }

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    if (gameRunning) requestAnimationFrame(gameLoop);
}

// ---- Game State Transitions ----

function startGame() {
    document.getElementById('title-screen').style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('hud').style.display = 'flex';

    resetGameState();
    gameRunning = true;
    updateMissionText();
    gameLoop();
}

function resetGameState() {
    score = 0;
    coins = 0;
    distance = 0;
    health = 100;
    gameSpeed = missions[currentMission].speed;
    frameCount = 0;
    obstacles = [];
    collectibles = [];
    particles = [];
    invincibleTimer = 0;
    activeCharIndex = 0;
    paused = false;

    characters.forEach(c => {
        c.y = GROUND_Y - c.height / 2 - (c.type === 'princess' ? 5 : 0);
        c.x = 120;
        c.vy = 0;
        c.grounded = true;
        c.ducking = false;
        if (c.type === 'unicorn') c.hasDoubleJump = true;
    });
    document.getElementById('active-char').textContent = 'Active: Sparkle';
}

function updateMissionText() {
    document.getElementById('mission-text').textContent =
        'Mission ' + (currentMission + 1) + ': ' + missions[currentMission].name;
}

function gameOver() {
    gameRunning = false;
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('final-score').textContent = 'Score: ' + score + ' | Coins: ' + coins;
    document.getElementById('final-distance').textContent = 'Distance: ' + Math.floor(distance) + 'm';
}

function missionComplete() {
    gameRunning = false;
    score += 200;
    document.getElementById('mission-complete').style.display = 'flex';
    document.getElementById('mission-result').textContent =
        missions[currentMission].name + ' completed! Score: ' + score;
}

function nextMission() {
    document.getElementById('mission-complete').style.display = 'none';
    currentMission++;

    if (currentMission >= missions.length) {
        document.getElementById('victory-screen').style.display = 'flex';
        document.getElementById('victory-score').textContent = 'Final Score: ' + score + ' | Coins: ' + coins;
        return;
    }

    distance = 0;
    obstacles = [];
    collectibles = [];
    particles = [];
    health = Math.min(100, health + 30);
    gameSpeed = missions[currentMission].speed;

    characters.forEach(c => {
        c.x = 120;
        c.y = GROUND_Y - c.height / 2;
        c.vy = 0;
        c.grounded = true;
    });

    updateMissionText();
    gameRunning = true;
    gameLoop();
}

function restartGame() {
    document.getElementById('game-over').style.display = 'none';
    resetGameState();
    gameRunning = true;
    gameLoop();
}

function goToTitle() {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('mission-complete').style.display = 'none';
    canvas.style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('title-screen').style.display = 'flex';
    currentMission = 0;
    gameRunning = false;
}

// ---- Title Screen Character Previews ----

function drawPreviews() {
    // Unicorn preview
    const uc = document.getElementById('preview-unicorn').getContext('2d');
    uc.clearRect(0, 0, 80, 80);
    uc.save();
    uc.translate(35, 50);
    uc.scale(0.8, 0.8);
    // Simple unicorn
    uc.fillStyle = '#f0e0ff';
    uc.beginPath(); uc.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2); uc.fill();
    uc.fillStyle = '#f5eaff';
    uc.beginPath(); uc.arc(18, -8, 10, 0, Math.PI * 2); uc.fill();
    uc.fillStyle = '#d946ef';
    uc.beginPath(); uc.moveTo(20, -18); uc.lineTo(24, -34); uc.lineTo(28, -18); uc.fill();
    uc.fillStyle = '#c084fc';
    for (let i = 0; i < 3; i++) {
        uc.beginPath(); uc.ellipse(6 - i * 7, -16, 5, 3, 0, 0, Math.PI * 2); uc.fill();
    }
    uc.fillStyle = '#6b21a8';
    uc.beginPath(); uc.arc(22, -9, 2, 0, Math.PI * 2); uc.fill();
    uc.restore();

    // Princess preview
    const pc = document.getElementById('preview-princess').getContext('2d');
    pc.clearRect(0, 0, 80, 80);
    pc.save();
    pc.translate(40, 45);
    pc.scale(0.8, 0.8);
    pc.fillStyle = '#ec4899';
    roundRect(pc, -24, 2, 48, 18, 4); pc.fill();
    pc.fillStyle = '#333';
    pc.beginPath(); pc.arc(-14, 20, 7, 0, Math.PI * 2); pc.fill();
    pc.beginPath(); pc.arc(14, 20, 7, 0, Math.PI * 2); pc.fill();
    pc.fillStyle = '#fde68a';
    pc.beginPath(); pc.arc(2, -18, 9, 0, Math.PI * 2); pc.fill();
    pc.fillStyle = '#fbbf24';
    pc.beginPath();
    pc.moveTo(-4, -27); pc.lineTo(-2, -33); pc.lineTo(2, -29); pc.lineTo(6, -35); pc.lineTo(10, -29); pc.lineTo(12, -33); pc.lineTo(14, -27);
    pc.fill();
    pc.restore();

    // Mushroom preview
    const mc = document.getElementById('preview-mushroom').getContext('2d');
    mc.clearRect(0, 0, 80, 80);
    mc.save();
    mc.translate(40, 48);
    mc.scale(0.9, 0.9);
    mc.fillStyle = '#fef3c7';
    mc.fillRect(-7, 0, 14, 16);
    mc.fillStyle = '#ef4444';
    mc.beginPath(); mc.ellipse(0, -2, 18, 14, 0, Math.PI, Math.PI * 2); mc.fill();
    mc.beginPath(); mc.ellipse(0, -2, 18, 4, 0, 0, Math.PI); mc.fill();
    mc.fillStyle = '#fef2f2';
    mc.beginPath(); mc.arc(-8, -9, 4, 0, Math.PI * 2); mc.fill();
    mc.beginPath(); mc.arc(5, -11, 3, 0, Math.PI * 2); mc.fill();
    mc.beginPath(); mc.arc(-1, -14, 2.5, 0, Math.PI * 2); mc.fill();
    mc.fillStyle = 'white';
    mc.beginPath(); mc.arc(-5, 4, 4, 0, Math.PI * 2); mc.fill();
    mc.beginPath(); mc.arc(5, 4, 4, 0, Math.PI * 2); mc.fill();
    mc.fillStyle = '#1a1a2e';
    mc.beginPath(); mc.arc(-4, 4, 2.5, 0, Math.PI * 2); mc.fill();
    mc.beginPath(); mc.arc(6, 4, 2.5, 0, Math.PI * 2); mc.fill();
    mc.restore();
}

drawPreviews();
