const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// UI
const cakesText = document.getElementById("cakes");
const stageText = document.getElementById("stage");

const gameMessage = document.createElement("div");
gameMessage.style.position = "fixed";
gameMessage.style.top = "10%";
gameMessage.style.left = "50%";
gameMessage.style.transform = "translate(-50%, 0)";
gameMessage.style.backgroundColor = "rgba(0,0,0,0.8)";
gameMessage.style.color = "white";
gameMessage.style.padding = "20px";
gameMessage.style.borderRadius = "10px";
gameMessage.style.fontSize = "24px";
gameMessage.style.textAlign = "center";
gameMessage.style.zIndex = "1000";
gameMessage.style.display = "none";
document.body.appendChild(gameMessage);

const WORLD_WIDTH = 12000;
let gameOver = false;
let gameWon = false;
let gameLoopId = null;

// 🔥 Descuento persistente en sessionStorage
let discount = parseInt(sessionStorage.getItem('seezawDiscount')) || 50;
let allCakesCollected = false;
const TOTAL_CAKES = 24;

let canDoubleJump = false;
let doubleJumpUsed = false;
let canKillEnemies = false;
let reviveUsed = false;
let invincible = false;
let invincibleTimer = null;
let jumpPressed = false;

const player = {
    x: 100, y: 300, width: 50, height: 50,
    velocityX: 0, velocityY: 0, speed: 5, jumpPower: -14, gravity: 0.7,
    grounded: false, cakes: 0, stage: 0,
    onMovingPlatform: false, movingPlatformVelocity: 0,
    facingRight: true,
    animationState: 'idle',
    animationFrame: 0,
    animationTimer: 0
};

const stages = ["Bebé", "Niño", "Adolescente", "Adulto", "Anciano"];
const stageKeys = ["baby", "child", "teen", "adult", "elder"];

// =========================
// IMÁGENES
// =========================
const images = {};
const imageSizes = {};

function loadImage(key, src) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        images[key] = img;
        imageSizes[key] = { width: img.width, height: img.height };
    };
    img.onerror = () => console.warn(`No se pudo cargar: ${src}`);
}

function loadAllImages() {
    loadImage('background', 'img/background.png');
    loadImage('clouds', 'img/clouds.png');
    loadImage('ground_tile', 'img/ground_tile.png');
    loadImage('platform_tile', 'img/platform_tile.png');
    loadImage('moving_platform_tile', 'img/moving_platform_tile.png');
    loadImage('cake', 'img/cake.png');
    loadImage('arrow_left', 'img/arrow_left.png');
    loadImage('arrow_right', 'img/arrow_right.png');
    loadImage('jump_btn', 'img/jump_btn.png');

    stageKeys.forEach(key => loadImage(key, `img/${key}.png`));
    const enemyColors = ['red','orange','darkorange','crimson','darkred','purple','indigo','violet','darkviolet','black','dimgray','black2'];
    enemyColors.forEach(color => loadImage(`enemy_${color}`, `img/enemy_${color}.png`));
}

// =========================
// ANIMACIONES
// =========================
const ANIM_FRAMES = { idle: 4, walk: 6, jump: 5 };

function drawPlayerSprite() {
    const key = stageKeys[player.stage];
    const img = images[key];
    if (!img || !img.complete) {
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        return;
    }

    const frameW = img.width / 6;
    const frameH = img.height / 3;

    let row, maxFrames;
    if (player.animationState === 'idle') { row = 0; maxFrames = ANIM_FRAMES.idle; }
    else if (player.animationState === 'walk') { row = 1; maxFrames = ANIM_FRAMES.walk; }
    else { row = 2; maxFrames = ANIM_FRAMES.jump; }

    const col = player.animationFrame % maxFrames;
    const sx = Math.floor(col * frameW);
    const sy = Math.floor(row * frameH);

    ctx.save();
    if (!player.facingRight) {
        ctx.translate(player.x + player.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, frameW, frameH, 0, player.y, player.width, player.height);
    } else {
        ctx.drawImage(img, sx, sy, frameW, frameH, player.x, player.y, player.width, player.height);
    }
    ctx.restore();
}

function drawEnemySprite(enemy) {
    const colorKey = enemy.spriteColor || enemy.color;
    const img = images[`enemy_${colorKey}`];
    const VISUAL_SIZE = 64;
    const drawX = enemy.x - (VISUAL_SIZE - enemy.width) / 2;
    const drawY = enemy.y - (VISUAL_SIZE - enemy.height) / 2 + 6;

    if (!img || !img.complete) {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        return;
    }

    const frameW = img.width / 2;
    const frameH = img.height / 2;

    let row = 0, maxFrames = 2;
    if (enemy.squashed) { row = 1; maxFrames = 1; }

    const col = (enemy.animFrame || 0) % maxFrames;
    const sx = Math.floor(col * frameW);
    const sy = Math.floor(row * frameH);

    if (colorKey === 'black' || colorKey === 'black2') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, sx, sy, frameW, frameH, drawX, drawY, VISUAL_SIZE, VISUAL_SIZE);
        ctx.restore();
    } else {
        ctx.drawImage(img, sx, sy, frameW, frameH, drawX, drawY, VISUAL_SIZE, VISUAL_SIZE);
    }
}

// =========================
// PLATAFORMAS, PASTELES, ENEMIGOS (completos)
// =========================
const platforms = [
    {id:"p1", x:0, y:500, width:400, height:100},
    {id:"p2", x:300, y:420, width:150, height:40},
    {id:"p3", x:480, y:350, width:100, height:40},
    {id:"p4", x:650, y:500, width:200, height:80},
    {id:"p5", x:900, y:400, width:180, height:40},
    {id:"p6", x:1100, y:320, width:120, height:40},
    {id:"p7", x:1300, y:240, width:120, height:40},
    {id:"p8", x:1550, y:500, width:300, height:80},
    {id:"p9", x:1950, y:380, width:60, height:40},
    {id:"p10", x:2080, y:300, width:60, height:40},
    {id:"p11", x:2210, y:220, width:60, height:40},
    {id:"p12", x:2400, y:500, width:250, height:80},
    {id:"p13", x:2750, y:450, width:150, height:40},
    {id:"p14", x:2950, y:370, width:100, height:40},
    {id:"p15", x:3150, y:290, width:100, height:40},
    {id:"p16", x:3400, y:500, width:400, height:30},
    {id:"p17", x:3400, y:330, width:400, height:30},
    {id:"p18", x:3800, y:500, width:300, height:80},
    {id:"p19", x:4200, y:420, width:120, height:40},
    {id:"p20", x:4350, y:350, width:80, height:40},
    {id:"p21", x:4500, y:280, width:80, height:40},
    {id:"p22", x:4650, y:210, width:80, height:40},
    {id:"p23", x:4850, y:500, width:350, height:80},
    {id:"p24", x:5300, y:400, width:150, height:40},
    {id:"p25", x:5600, y:400, width:150, height:40},
    {id:"p26", x:5900, y:350, width:150, height:40},
    {id:"p27", x:6150, y:280, width:100, height:40},
    {id:"p28", x:6400, y:210, width:100, height:40},
    {id:"p29", x:6650, y:500, width:250, height:80},
    {id:"p30", x:7000, y:350, width:140, height:40},
    {id:"p31", x:7160, y:400, width:100, height:40},
    {id:"p32", x:7300, y:450, width:100, height:40},
    {id:"p33", x:7450, y:500, width:200, height:80},
    {id:"p34", x:7750, y:380, width:110, height:40},
    {id:"p35", x:7950, y:300, width:70, height:40},
    {id:"p36", x:8150, y:220, width:70, height:40},
    {id:"p37", x:8400, y:500, width:300, height:80},
    {id:"p38_movable", x:8800, y:450, width:120, height:40, movable:true, moveRange:200, moveSpeed:2, startX:8800},
    {id:"p39_movable", x:9100, y:350, width:120, height:40, movable:true, moveRange:250, moveSpeed:2.5, startX:9100},
    {id:"p40", x:9400, y:400, width:120, height:40},
    {id:"p41", x:9550, y:320, width:80, height:40},
    {id:"p42", x:9700, y:240, width:80, height:40},
    {id:"p43", x:9900, y:550, width:300, height:30},
    {id:"p44", x:10300, y:420, width:110, height:40},
    {id:"p45", x:10500, y:340, width:70, height:40},
    {id:"p46", x:10700, y:260, width:70, height:40},
    {id:"p47", x:11000, y:500, width:400, height:100},
    {id:"p48", x:11500, y:400, width:200, height:40}
];

const initialCakes = [
    {x:360, y:370, width:30, height:30, collected:false},
    {x:510, y:300, width:30, height:30, collected:false},
    {x:980, y:350, width:30, height:30, collected:false},
    {x:1130, y:270, width:30, height:30, collected:false},
    {x:1330, y:190, width:30, height:30, collected:false},
    {x:1980, y:330, width:30, height:30, collected:false},
    {x:2110, y:250, width:30, height:30, collected:false},
    {x:2780, y:400, width:30, height:30, collected:false},
    {x:2980, y:320, width:30, height:30, collected:false},
    {x:3180, y:240, width:30, height:30, collected:false},
    {x:3600, y:460, width:30, height:30, collected:false},
    {x:4250, y:370, width:30, height:30, collected:false},
    {x:4400, y:300, width:30, height:30, collected:false},
    {x:4550, y:230, width:30, height:30, collected:false},
    {x:5330, y:350, width:30, height:30, collected:false},
    {x:5930, y:300, width:30, height:30, collected:false},
    {x:6180, y:230, width:30, height:30, collected:false},
    {x:7030, y:300, width:30, height:30, collected:false},
    {x:7180, y:350, width:30, height:30, collected:false},
    {x:7780, y:330, width:30, height:30, collected:false},
    {x:8180, y:170, width:30, height:30, collected:false},
    {x:8850, y:400, width:30, height:30, collected:false},
    {x:10330, y:370, width:30, height:30, collected:false},
    {x:10530, y:290, width:30, height:30, collected:false}
];
let cakes = JSON.parse(JSON.stringify(initialCakes));

const initialEnemies = [
    {id:"e1", x:350, y:0, width:40, height:40, color:"red", spriteColor:"red", direction:1, speed:1.0, platformId:"p2", animFrame:0, squashed:false, animTimer:0},
    {id:"e2", x:950, y:0, width:40, height:40, color:"orange", spriteColor:"orange", direction:1, speed:1.4, platformId:"p5", animFrame:0, squashed:false, animTimer:0},
    {id:"e3", x:2780, y:0, width:40, height:40, color:"darkorange", spriteColor:"darkorange", direction:1, speed:1.8, platformId:"p13", animFrame:0, squashed:false, animTimer:0},
    {id:"e4", x:3520, y:0, width:40, height:40, color:"crimson", spriteColor:"crimson", direction:1, speed:2.2, platformId:"p16", animFrame:0, squashed:false, animTimer:0},
    {id:"e5", x:4230, y:0, width:40, height:40, color:"darkred", spriteColor:"darkred", direction:1, speed:2.2, platformId:"p19", animFrame:0, squashed:false, animTimer:0},
    {id:"e6", x:5350, y:0, width:40, height:40, color:"purple", spriteColor:"purple", direction:1, speed:2.5, platformId:"p24", animFrame:0, squashed:false, animTimer:0},
    {id:"e7", x:5930, y:0, width:40, height:40, color:"indigo", spriteColor:"indigo", direction:1, speed:2.8, platformId:"p26", animFrame:0, squashed:false, animTimer:0},
    {id:"e8", x:7030, y:0, width:40, height:40, color:"violet", spriteColor:"violet", direction:1, speed:2.2, platformId:"p30", animFrame:0, squashed:false, animTimer:0},
    {id:"e9", x:7770, y:0, width:40, height:40, color:"darkviolet", spriteColor:"darkviolet", direction:1, speed:3.2, platformId:"p34", animFrame:0, squashed:false, animTimer:0},
    {id:"e10", x:8850, y:0, width:40, height:40, color:"black", spriteColor:"black", direction:1, speed:2.2, platformId:"p38_movable", isOnMovingPlatform:true, animFrame:0, squashed:false, animTimer:0},
    {id:"e11", x:9430, y:0, width:40, height:40, color:"dimgray", spriteColor:"dimgray", direction:1, speed:2.8, platformId:"p40", animFrame:0, squashed:false, animTimer:0},
    {id:"e12", x:10330, y:0, width:40, height:40, color:"black", spriteColor:"black2", direction:1, speed:3.5, platformId:"p44", animFrame:0, squashed:false, animTimer:0}
];
let enemies = JSON.parse(JSON.stringify(initialEnemies));

// =========================
// PLATAFORMAS MÓVILES
// =========================
let movablePlatforms = [];
let platformMap = new Map();

function initMovablePlatforms() {
    movablePlatforms = [];
    platformMap.clear();
    for (let p of platforms) {
        platformMap.set(p.id, p);
        if (p.movable) {
            movablePlatforms.push({ ...p, currentX: p.startX, previousX: p.startX, direction: 1 });
        }
    }
}

function initEnemiesPosition() {
    for (let enemy of enemies) {
        const plat = platformMap.get(enemy.platformId);
        if (!plat) continue;
        enemy.y = plat.y - enemy.height;
        const margin = 10;
        enemy.minX = plat.x + margin;
        enemy.maxX = plat.x + plat.width - enemy.width - margin;
        if (enemy.minX >= enemy.maxX) {
            enemy.minX = plat.x;
            enemy.maxX = plat.x + plat.width - enemy.width;
        }
        enemy.x = Math.min(Math.max(enemy.x, enemy.minX), enemy.maxX);
        if (plat.movable && enemy.isOnMovingPlatform) {
            const mp = movablePlatforms.find(m => m.id === plat.id);
            if (mp) enemy.relativeX = enemy.x - mp.currentX;
        }
    }
}

function updateMovablePlatforms() {
    for (let mp of movablePlatforms) {
        mp.previousX = mp.currentX;
        mp.currentX += mp.moveSpeed * mp.direction;
        if (mp.currentX >= mp.startX + mp.moveRange) {
            mp.currentX = mp.startX + mp.moveRange;
            mp.direction = -1;
        } else if (mp.currentX <= mp.startX - mp.moveRange) {
            mp.currentX = mp.startX - mp.moveRange;
            mp.direction = 1;
        }
    }
}

function updateEnemiesPosition() {
    for (let enemy of enemies) {
        const plat = platformMap.get(enemy.platformId);
        if (!plat) continue;
        enemy.y = plat.y - enemy.height;
        if (plat.movable && enemy.isOnMovingPlatform) {
            const mp = movablePlatforms.find(m => m.id === plat.id);
            if (!mp) continue;
            if (enemy.relativeX === undefined) enemy.relativeX = enemy.x - mp.currentX;
            enemy.relativeX += enemy.speed * enemy.direction;
            const minRel = enemy.minX - plat.startX;
            const maxRel = enemy.maxX - plat.startX;
            if (enemy.relativeX <= minRel) { enemy.relativeX = minRel; enemy.direction = 1; }
            if (enemy.relativeX >= maxRel) { enemy.relativeX = maxRel; enemy.direction = -1; }
            enemy.x = mp.currentX + enemy.relativeX;
        } else {
            enemy.x += enemy.speed * enemy.direction;
            if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.direction = 1; }
            if (enemy.x >= enemy.maxX) { enemy.x = enemy.maxX; enemy.direction = -1; }
        }

        if (enemy.animTimer === undefined) enemy.animTimer = 0;
        enemy.animTimer++;
        if (enemy.animTimer >= 15) {
            enemy.animTimer = 0;
            enemy.animFrame = (enemy.animFrame || 0) + 1;
        }
    }
}

// =========================
// CONTROLES Y MENSAJES
// =========================
const keys = {};
window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);

function showMessage(text, isError = false) {
    gameMessage.textContent = text;
    gameMessage.style.backgroundColor = isError ? "rgba(220,20,60,0.9)" : "rgba(0,0,0,0.8)";
    gameMessage.style.display = "block";
    setTimeout(() => { if (!gameOver && !gameWon) gameMessage.style.display = "none"; }, 2000);
}

function safePlay(soundKey) {
    if (typeof AudioEngine !== 'undefined') { try { AudioEngine.play(soundKey); } catch(e) {} }
}

// 🔥 Ahora descuento se lee de sessionStorage y nunca se resetea a 50 hasta que se cierre la sesión
function resetGame() {
    gameOver = false; gameWon = false;
    // Mantenemos el descuento actual desde sessionStorage (ya se actualiza en cada muerte)
    discount = parseInt(sessionStorage.getItem('seezawDiscount')) || 50;
    allCakesCollected = false;
    player.x = 100; player.y = 300; player.velocityX = 0; player.velocityY = 0;
    player.width = 50; player.height = 50; player.speed = 5; player.jumpPower = -14;
    player.cakes = 0; player.stage = 0; player.grounded = false;
    player.onMovingPlatform = false; player.movingPlatformVelocity = 0;
    player.facingRight = true; player.animationState = 'idle'; player.animationFrame = 0; player.animationTimer = 0;
    canDoubleJump = false; doubleJumpUsed = false; canKillEnemies = false;
    reviveUsed = false; invincible = false;
    if (invincibleTimer) clearTimeout(invincibleTimer);
    cakes = JSON.parse(JSON.stringify(initialCakes));
    enemies = JSON.parse(JSON.stringify(initialEnemies));
    cakesText.textContent = "0"; stageText.textContent = stages[0]; gameMessage.style.display = "none";
    initMovablePlatforms(); initEnemiesPosition();
    if (typeof AudioEngine !== 'undefined') { try { AudioEngine.stopBGM(); AudioEngine.playBGM(); } catch(e) {} }
}

function movePlayer() {
    let spd = player.speed;
    if (player.grounded && player.x > 3400 && player.x < 3800 && player.y > 180 && player.y < 520) spd = 3;
    if (keys["ArrowLeft"] || keys["a"]) player.velocityX = -spd;
    else if (keys["ArrowRight"] || keys["d"]) player.velocityX = spd;
    else player.velocityX = 0;

    if (keys["ArrowUp"] || keys["w"] || keys[" "]) {
        if (!jumpPressed) {
            if (player.grounded) {
                player.velocityY = player.jumpPower; player.grounded = false;
                doubleJumpUsed = false; player.onMovingPlatform = false;
                safePlay('jump');
            } else if (canDoubleJump && !doubleJumpUsed) {
                player.velocityY = player.jumpPower; doubleJumpUsed = true;
                safePlay('jump');
            }
        }
        jumpPressed = true;
    } else jumpPressed = false;

    if (player.velocityY < 0) player.velocityY += player.gravity * 0.8;
    else player.velocityY += player.gravity;
    if (player.velocityY > 18) player.velocityY = 18;
    player.x += player.velocityX; player.y += player.velocityY;
    player.x = Math.max(0, Math.min(player.x, WORLD_WIDTH - player.width));

    if (player.velocityX > 0) player.facingRight = true;
    else if (player.velocityX < 0) player.facingRight = false;

    if (!player.grounded) {
        player.animationState = 'jump';
    } else if (Math.abs(player.velocityX) > 0) {
        player.animationState = 'walk';
    } else {
        player.animationState = 'idle';
    }
    player.animationTimer++;
    if (player.animationTimer >= 10) {
        player.animationTimer = 0;
        player.animationFrame++;
    }
}

function checkPlatformCollision() {
    player.grounded = false;
    let standingOnMovable = null, platformVelocity = 0;
    let allPlatforms = [...platforms];
    movablePlatforms.forEach(mp => allPlatforms.push(mp));

    for (let p of allPlatforms) {
        const px = p.movable ? (movablePlatforms.find(m => m.id === p.id)?.currentX ?? p.x) : p.x;
        let bottom = player.y + player.height, prevBottom = bottom - player.velocityY;
        if (player.x + player.width > px && player.x < px + p.width &&
            bottom > p.y && player.y < p.y + p.height && player.velocityY >= 0 && prevBottom <= p.y) {
            player.y = p.y - player.height; player.velocityY = 0; player.grounded = true; doubleJumpUsed = false;
            if (p.movable) {
                standingOnMovable = p;
                const mp = movablePlatforms.find(m => m.id === p.id);
                if (mp && mp.previousX !== undefined) platformVelocity = mp.currentX - mp.previousX;
            }
            break;
        }
    }

    if (standingOnMovable) {
        player.onMovingPlatform = true;
        player.movingPlatformVelocity = platformVelocity;
        player.x += platformVelocity;
    } else {
        player.onMovingPlatform = false;
        player.movingPlatformVelocity = 0;
    }
}

function collectCakes() {
    for (let cake of cakes) {
        if (!cake.collected && player.x < cake.x + cake.width && player.x + player.width > cake.x &&
            player.y < cake.y + cake.height && player.y + player.height > cake.y) {
            cake.collected = true; player.cakes++; cakesText.textContent = player.cakes;
            showMessage(`+1 Pastel (${player.cakes})`); safePlay('collectCake'); updateStage();
        }
    }
}

function updateStage() {
    const sizes = [50, 55, 60, 65, 70];
    let oldH = player.height, oldY = player.y;
    if (player.cakes >= 4 && player.stage < 1) {
        player.stage = 1; player.width = sizes[1]; player.height = sizes[1];
        safePlay('evolve');
    }
    if (player.cakes >= 8 && player.stage < 2) {
        player.stage = 2; canKillEnemies = true;
        player.width = sizes[2]; player.height = sizes[2];
        safePlay('evolve');
    }
    if (player.cakes >= 13 && player.stage < 3) {
        player.stage = 3; canDoubleJump = true; player.speed = 6;
        player.width = sizes[3]; player.height = sizes[3];
        safePlay('evolve');
    }
    if (player.cakes >= 18 && player.stage < 4) {
        player.stage = 4; player.speed = 5;
        player.width = sizes[4]; player.height = sizes[4];
        safePlay('evolve');
    }
    if (player.height > oldH) player.y = oldY - (player.height - oldH);
    stageText.textContent = stages[player.stage];
}

// 🔥 Actualiza descuento y guarda en sessionStorage
function decreaseDiscount() {
    discount = Math.max(5, discount - 5);
    sessionStorage.setItem('seezawDiscount', discount);
}

function checkEnemyCollision() {
    if (gameOver || gameWon) return;
    const pHitbox = {
        x: player.x + 6, y: player.y + 8,
        w: player.width - 12, h: player.height - 12
    };
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        const eHitbox = {
            x: e.x + 8, y: e.y + 6,
            w: e.width - 16, h: e.height - 12
        };
        if (pHitbox.x < eHitbox.x + eHitbox.w && pHitbox.x + pHitbox.w > eHitbox.x &&
            pHitbox.y < eHitbox.y + eHitbox.h && pHitbox.y + pHitbox.h > eHitbox.y) {
            let prevBottom = player.y + player.height - player.velocityY;
            let wasAbove = prevBottom <= e.y + 10;
            let comingDown = player.velocityY > 0;

            if (canKillEnemies && wasAbove && comingDown) {
                enemies.splice(i, 1); player.velocityY = -12;
                showMessage("💀 Enemigo derrotado"); safePlay('defeatEnemy'); continue;
            }
            if (player.stage === 4 && !reviveUsed && !invincible) {
                reviveUsed = true; invincible = true;
                player.x = Math.max(0, player.x - 200); player.y = Math.max(0, player.y - 100);
                player.velocityY = -12; showMessage("🛡️ ¡Poder anciano! Invencible por 3 segundos");
                if (invincibleTimer) clearTimeout(invincibleTimer);
                invincibleTimer = setTimeout(() => { invincible = false; showMessage("Invencibilidad terminada"); }, 3000);
                continue;
            }
            if (invincible) continue;

            decreaseDiscount(); // 🔥 Descuento se reduce y guarda
            gameOver = true;
            showMessage("💀 GAME OVER 💀", true);
            document.getElementById('gameOverScreen').style.display = 'flex';
            safePlay('gameOver');
            if (typeof AudioEngine !== 'undefined') { try { AudioEngine.stopBGM(); } catch(e) {} }
            if (gameLoopId) cancelAnimationFrame(gameLoopId);
            return;
        }
    }
}

// =========================
// CÁMARA
// =========================
let cameraX = 0;
function updateCamera() {
    cameraX = Math.max(0, Math.min(player.x + player.width/2 - canvas.width/2, WORLD_WIDTH - canvas.width));
}

// =========================
// FUNCIÓN DE VISIBILIDAD
// =========================
function isVisible(objX, objY, objW, objH) {
    return (objX + objW > cameraX && objX < cameraX + canvas.width &&
            objY + objH > 0 && objY < canvas.height);
}

// =========================
// DIBUJO DEL MUNDO
// =========================
function drawBackground() {
    const bg = images['background'];
    if (bg && bg.complete) {
        const tileW = bg.width;
        const tileH = canvas.height;
        const startX = Math.floor(cameraX / tileW) * tileW;
        const endX = cameraX + canvas.width + tileW;
        for (let x = startX; x < endX; x += tileW) {
            ctx.drawImage(bg, x, 0, tileW, tileH);
        }
    } else {
        ctx.fillStyle = "#87CEEB";
        ctx.fillRect(0, 0, WORLD_WIDTH, canvas.height);
    }

    const cloudImg = images['clouds'];
    if (cloudImg && cloudImg.complete) {
        const cloudW = cloudImg.width;
        const cloudH = cloudImg.height;
        const timeDrift = (Date.now() * 0.02) % cloudW;
        const cameraOffset = cameraX * 0.3;
        const totalOffset = timeDrift + cameraOffset;
        const visibleStart = cameraX - totalOffset;
        const visibleEnd = visibleStart + canvas.width + cloudW;
        let startTile = Math.floor(visibleStart / cloudW) * cloudW;
        for (let x = startTile; x < visibleEnd; x += cloudW) {
            ctx.drawImage(cloudImg, x, 50, cloudW, cloudH);
        }
    }

    const ground = images['ground_tile'];
    if (ground && ground.complete) {
        const tileW = ground.width;
        const tileH = ground.height;
        const startX = Math.floor(cameraX / tileW) * tileW;
        const endX = cameraX + canvas.width + tileW;
        for (let x = startX; x < endX; x += tileW) {
            for (let y = 600; y < canvas.height; y += tileH) {
                ctx.drawImage(ground, x, y, tileW, tileH);
            }
        }
    } else {
        ctx.fillStyle = "#D2B48C";
        ctx.fillRect(0, 600, WORLD_WIDTH, canvas.height - 600);
    }
}

function drawPlatforms() {
    for (let p of platforms) {
        const tileKey = p.movable ? 'moving_platform_tile' : 'platform_tile';
        const xPos = p.movable ? (movablePlatforms.find(m => m.id === p.id)?.currentX ?? p.x) : p.x;
        if (!isVisible(xPos, p.y, p.width, p.height)) continue;
        const img = images[tileKey];
        if (img && img.complete) {
            const tileW = img.width;
            let x = xPos;
            while (x < xPos + p.width) {
                const drawWidth = Math.min(tileW, xPos + p.width - x);
                ctx.drawImage(img, 0, 0, drawWidth, img.height, x, p.y, drawWidth, p.height);
                x += drawWidth;
            }
        } else {
            ctx.fillStyle = p.movable ? "#DAA520" : "#8B4513";
            ctx.fillRect(xPos, p.y, p.width, p.height);
        }
    }
}

function drawCakes() {
    for (let cake of cakes) {
        if (cake.collected) continue;
        if (!isVisible(cake.x, cake.y, cake.width, cake.height)) continue;
        const img = images['cake'];
        if (img && img.complete) {
            ctx.drawImage(img, cake.x, cake.y, cake.width, cake.height);
        } else {
            ctx.fillStyle = "#FF69B4";
            ctx.fillRect(cake.x, cake.y, cake.width, cake.height);
        }
    }
}

// =========================
// GAME LOOP (con nueva lógica de descuento)
// =========================
function gameLoop() {
    if (gameOver || gameWon) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateCamera();
    ctx.save();
    ctx.translate(-cameraX, 0);

    updateMovablePlatforms();
    updateEnemiesPosition();
    movePlayer();
    checkPlatformCollision();
    collectCakes();
    checkEnemyCollision();

    if (player.y > 1200) {
        decreaseDiscount(); // 🔥 descuento por caída
        gameOver = true;
        showMessage("🌊 Caíste al vacío 🌊", true);
        document.getElementById('gameOverScreen').style.display = 'flex';
        safePlay('gameOver');
        if (typeof AudioEngine !== 'undefined') { try { AudioEngine.stopBGM(); } catch(e) {} }
        ctx.restore();
        return;
    }

    drawBackground();
    drawPlatforms();
    drawCakes();
    for (let enemy of enemies) {
        if (enemy.animFrame === undefined) enemy.animFrame = 0;
        if (enemy.squashed === undefined) enemy.squashed = false;
        if (isVisible(enemy.x - 10, enemy.y - 10, enemy.width + 20, enemy.height + 20)) {
            drawEnemySprite(enemy);
        }
    }
    drawPlayerSprite();

    if (player.x + player.width >= WORLD_WIDTH - 200) {
        gameWon = true;
        
        const collectedCakes = cakes.filter(c => c.collected).length;
        allCakesCollected = collectedCakes === TOTAL_CAKES;
        
        if (allCakesCollected) {
            document.getElementById('winMessage').textContent = '¡Conseguiste todos los pasteles!';
            document.getElementById('discountBox').style.display = 'block';
            document.getElementById('discountCode').textContent = 'DULCES' + discount;
            document.getElementById('discountText').textContent = discount + '% de descuento en Seezaw Pastry Shop';
            document.getElementById('winRestartBtn').style.display = 'none'; // No se puede reiniciar
        } else {
            document.getElementById('winMessage').textContent = 'Has completado el viaje, pero te faltaron pasteles. ¡Sin descuento!';
            document.getElementById('discountBox').style.display = 'none';
            document.getElementById('winRestartBtn').style.display = 'none';
        }
        
        document.getElementById('winScreen').style.display = 'flex';
        showMessage("🎉 ¡FELICIDADES! 🎉");
        if (typeof AudioEngine !== 'undefined') { try { AudioEngine.stopBGM(); } catch(e) {} }
    }

    ctx.restore();
    gameLoopId = requestAnimationFrame(gameLoop);
}

// =========================
// CONTROLES TÁCTILES
// =========================
function addTouchControls() {
    const jumpBtn = document.createElement("button");
    jumpBtn.style.position = "fixed"; jumpBtn.style.bottom = "30px"; jumpBtn.style.left = "30px";
    jumpBtn.style.width = "80px"; jumpBtn.style.height = "80px"; jumpBtn.style.border = "none";
    jumpBtn.style.backgroundImage = "url('img/jump_btn.png')";
    jumpBtn.style.backgroundSize = "cover";
    jumpBtn.style.backgroundColor = "transparent";
    jumpBtn.style.zIndex = "1000";
    jumpBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowUp"] = true; keys[" "] = true; });
    jumpBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowUp"] = false; keys[" "] = false; });
    jumpBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowUp"] = true; keys[" "] = true; });
    jumpBtn.addEventListener("mouseup", (e) => { e.preventDefault(); keys["ArrowUp"] = false; keys[" "] = false; });
    document.body.appendChild(jumpBtn);

    const moveContainer = document.createElement("div");
    moveContainer.style.position = "fixed"; moveContainer.style.bottom = "30px"; moveContainer.style.right = "30px";
    moveContainer.style.display = "flex"; moveContainer.style.gap = "15px"; moveContainer.style.zIndex = "1000";

    const leftBtn = document.createElement("button");
    leftBtn.style.width = "70px"; leftBtn.style.height = "70px"; leftBtn.style.border = "none";
    leftBtn.style.backgroundImage = "url('img/arrow_left.png')";
    leftBtn.style.backgroundSize = "cover";
    leftBtn.style.backgroundColor = "transparent";
    leftBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; });
    leftBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowLeft"] = false; });
    leftBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; });
    leftBtn.addEventListener("mouseup", (e) => { e.preventDefault(); keys["ArrowLeft"] = false; });

    const rightBtn = document.createElement("button");
    rightBtn.style.width = "70px"; rightBtn.style.height = "70px"; rightBtn.style.border = "none";
    rightBtn.style.backgroundImage = "url('img/arrow_right.png')";
    rightBtn.style.backgroundSize = "cover";
    rightBtn.style.backgroundColor = "transparent";
    rightBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowRight"] = true; });
    rightBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowRight"] = false; });
    rightBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowRight"] = true; });
    rightBtn.addEventListener("mouseup", (e) => { e.preventDefault(); keys["ArrowRight"] = false; });

    moveContainer.appendChild(leftBtn); moveContainer.appendChild(rightBtn);
    document.body.appendChild(moveContainer);
}

// 🔥 Panel de reglas
document.getElementById('rulesBtn').addEventListener('click', () => {
    document.getElementById('rulesPanel').style.display = 'flex';
});

document.getElementById('closeRulesBtn').addEventListener('click', () => {
    document.getElementById('rulesPanel').style.display = 'none';
});

function manualReset() {
    document.getElementById('winScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    resetGame();
    gameLoop();
}

document.getElementById("startBtn").addEventListener("click", () => {
    document.getElementById("startScreen").style.display = "none";
    resetGame();
    gameLoop();
});

document.getElementById('overRestartBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').style.display = 'none';
    manualReset();
});

// 🔥 Ya NO creamos el botón "Reiniciar"

// Iniciar todo
loadAllImages();
initMovablePlatforms();
initEnemiesPosition();
addTouchControls();