const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

let bgImage = null;
let currentWeapon = 'gun';
const upload = document.getElementById('upload');
upload.addEventListener('change', e => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = event => {
    const img = new Image();
    img.onload = () => {
      bgImage = img;
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('weapon').addEventListener('change', e => {
  currentWeapon = e.target.value;
});

// Load decals
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const decals = {
  gun: [loadImage('textures/bullet1.png'), loadImage('textures/bullet2.png')],
  knife: [loadImage('textures/slash1.png'), loadImage('textures/slash2.png')],
  machete: [loadImage('textures/machete1.png'), loadImage('textures/machete2.png')],
  flame: [loadImage('textures/scorch1.png'), loadImage('textures/scorch2.png')],
  grenade: [loadImage('textures/crater1.png'), loadImage('textures/crater2.png')]
};

// Particles
let particles = [];
function createParticles(x, y, color) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x,
      y: y,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      life: 30,
      color: color
    });
  }
}

function updateParticles() {
  particles.forEach(p => {
    p.x += p.dx;
    p.y += p.dy;
    p.life -= 1;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 2, 2);
  });
}

// Screen shake
let shakeTime = 0;
function applyShake() {
  if (shakeTime > 0) {
    const dx = (Math.random() - 0.5) * 10;
    const dy = (Math.random() - 0.5) * 10;
    ctx.translate(dx, dy);
    shakeTime--;
  }
}

// Flash effect
let flashTime = 0;
function applyFlash() {
  if (flashTime > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashTime--;
  }
}

// Handle clicks
canvas.addEventListener('click', e => {
  if (!bgImage) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const set = decals[currentWeapon];
  const decal = set[Math.floor(Math.random() * set.length)];
  ctx.drawImage(decal, x - decal.width/2, y - decal.height/2);

  if (currentWeapon === 'gun') {
    createParticles(x, y, 'red');
    flashTime = 2;
  } else if (currentWeapon === 'knife') {
    createParticles(x, y, 'silver');
  } else if (currentWeapon === 'machete') {
    createParticles(x, y, 'darkred');
  } else if (currentWeapon === 'flame') {
    createParticles(x, y, 'orange');
  } else if (currentWeapon === 'grenade') {
    createParticles(x, y, 'gray');
    shakeTime = 10;
    flashTime = 5;
  }
});

function gameLoop() {
  if (bgImage) {
    ctx.save();
    applyShake();
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  updateParticles();
  drawParticles();
  applyFlash();
  requestAnimationFrame(gameLoop);
}
gameLoop();