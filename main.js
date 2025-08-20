(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const fileInput = document.getElementById("fileInput");
  const resetBtn = document.getElementById("resetBtn");
  const saveBtn = document.getElementById("saveBtn");
  const hint = document.getElementById("hint");
  const dropZone = document.getElementById("dropZone");

  // State
  let weapon = "gun";
  let imageBitmap = null;
  let imageRect = { x: 0, y: 0, w: 0, h: 0 };
  let isPointerDown = false;
  let last = { x: 0, y: 0 };
  let particles = [];
  let shakeT = 0;

  // Offscreen canvases to track damage and overlays
  const damage = document.createElement("canvas");
  const dmg = damage.getContext("2d");

  const scorch = document.createElement("canvas");
  const scr = scorch.getContext("2d");

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  // --- Simple SFX with WebAudio (no external files) ---
  let audioCtx;
  function sfxGun() { tone(220, 0.04, 0.0005); }
  function sfxKnife() { tone(100, 0.02, 0.002); }
  function sfxMachete() { tone(80, 0.05, 0.001); }
  function sfxFlame(start=true) { noise( start ? 0.15 : 0.07 ); }
  function sfxBoom() { sweep(120, 40, 0.35); }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  function tone(freq, dur=0.05, decay=0.001) {
    ensureAudio();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + decay);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + decay);
  }
  function sweep(startF, endF, dur=0.3) {
    ensureAudio();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(startF, t);
    o.frequency.exponentialRampToValueAtTime(endF, t + dur);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function noise(dur=0.15) {
    ensureAudio();
    const bufferSize = 2 * audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    g.gain.value = 0.15;
    src.buffer = buffer;
    src.connect(g).connect(audioCtx.destination);
    src.start();
  }

  // --- Helpers ---
  function resize() {
    const w = dropZone.clientWidth, h = dropZone.clientHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    damage.width = canvas.width;
    damage.height = canvas.height;
    dmg.setTransform(DPR, 0, 0, DPR, 0, 0);

    scorch.width = canvas.width;
    scorch.height = canvas.height;
    scr.setTransform(DPR, 0, 0, DPR, 0, 0);

    layoutImage();
    render();
  }

  function layoutImage() {
    if (!imageBitmap) return;
    const cw = canvas.width / DPR, ch = canvas.height / DPR;
    const iw = imageBitmap.width, ih = imageBitmap.height;
    const scale = Math.min(cw/iw, ch/ih);
    const w = iw*scale, h = ih*scale;
    imageRect = { x: (cw - w)/2, y: (ch - h)/2, w, h };
    // Clear damage/scorch when image changes size
    dmg.clearRect(0, 0, canvas.width, canvas.height);
    scr.clearRect(0, 0, canvas.width, canvas.height);
  }

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Slight screenshake
    if (shakeT > 0) {
      const mag = shakeT * 8;
      const dx = (Math.random()*2-1) * mag;
      const dy = (Math.random()*2-1) * mag;
      ctx.translate(dx, dy);
      shakeT *= 0.9;
      if (shakeT < 0.02) shakeT = 0;
    }

    // Draw image (if any)
    if (imageBitmap) {
      ctx.drawImage(
        imageBitmap,
        imageRect.x, imageRect.y, imageRect.w, imageRect.h
      );

      // Apply scorch overlay (darkening / burn marks)
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(scorch, 0, 0, canvas.width / DPR, canvas.height / DPR);
      ctx.globalCompositeOperation = "source-over";

      // Apply damage cutouts
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(damage, 0, 0, canvas.width / DPR, canvas.height / DPR);
      ctx.globalCompositeOperation = "source-over";
    }

    // Draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= 0.99; p.vy += 0.25; // gravity
      p.x += p.vx; p.y += p.vy;
      p.life -= 1;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
      if (p.life <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(render);
    ctx.restore();
  }

  function inImage(x, y) {
    return imageBitmap &&
      x >= imageRect.x && y >= imageRect.y &&
      x <= imageRect.x + imageRect.w &&
      y <= imageRect.y + imageRect.h;
  }

  function toImageCoords(x, y) {
    // Here we operate in canvas coords already, but keep for clarity
    return { x, y };
  }

  function dmgCircle(x, y, r) {
    dmg.save();
    dmg.globalCompositeOperation = "source-over";
    dmg.fillStyle = "rgba(255,255,255,1)";
    dmg.beginPath();
    dmg.arc(x, y, r, 0, Math.PI*2);
    dmg.fill();
    dmg.restore();
  }

  function scorchCircle(x, y, r) {
    // dark ring + inner glow
    const grad = scr.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(80,60,0,0.5)");
    grad.addColorStop(0.6, "rgba(40,20,0,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    scr.fillStyle = grad;
    scr.beginPath();
    scr.arc(x, y, r, 0, Math.PI*2);
    scr.fill();
  }

  function dmgLine(x1, y1, x2, y2, w) {
    dmg.save();
    dmg.globalCompositeOperation = "source-over";
    dmg.strokeStyle = "rgba(255,255,255,1)";
    dmg.lineCap = "round";
    dmg.lineJoin = "round";
    dmg.lineWidth = w;
    dmg.beginPath();
    dmg.moveTo(x1, y1);
    dmg.lineTo(x2, y2);
    dmg.stroke();
    dmg.restore();
  }

  function scorchLine(x1, y1, x2, y2, w) {
    scr.save();
    scr.globalCompositeOperation = "source-over";
    scr.strokeStyle = "rgba(50,30,0,0.35)";
    scr.lineCap = "round";
    scr.lineJoin = "round";
    scr.lineWidth = w*1.2;
    scr.beginPath();
    scr.moveTo(x1, y1);
    scr.lineTo(x2, y2);
    scr.stroke();
    scr.restore();
  }

  function makeParticles(x, y, n=16, speed=4, color="#b0b6c0") {
    for (let i=0;i<n;i++) {
      const a = Math.random()*Math.PI*2;
      const v = Math.random()*speed;
      particles.push({
        x, y,
        vx: Math.cos(a)*v,
        vy: Math.sin(a)*v,
        life: 30 + Math.random()*20,
        maxLife: 50,
        size: 2 + Math.random()*2,
        color
      });
    }
  }

  // --- Weapons ---
  function useGun(x, y) {
    const r = 8 + Math.random()*5;
    dmgCircle(x, y, r);
    makeParticles(x, y, 10, 3);
    sfxGun();
  }
  function useKnife(x1, y1, x2, y2) {
    const w = 6;
    dmgLine(x1, y1, x2, y2, w);
    makeParticles(x2, y2, 6, 2);
    sfxKnife();
  }
  function useMachete(x1, y1, x2, y2) {
    const w = 14;
    dmgLine(x1, y1, x2, y2, w);
    makeParticles(x2, y2, 10, 3);
    sfxMachete();
  }
  function useFlame(x, y) {
    const r = 18 + Math.random()*8;
    scorchCircle(x, y, r*1.2);
    dmgCircle(x + (Math.random()*6-3), y + (Math.random()*6-3), r*0.25);
    sfxFlame(true);
  }
  function useGrenade(x, y) {
    // Flash scorch + big crater + shake
    const R = 60 + Math.random()*30;
    for (let t=0; t<4; t++) scorchCircle(x, y, R*(1 + t*0.25));
    const grad = dmg.createRadialGradient(x, y, 0, x, y, R);
    dmg.save();
    dmg.fillStyle = "rgba(255,255,255,1)";
    dmg.beginPath();
    dmg.arc(x, y, R*0.85, 0, Math.PI*2);
    dmg.fill();
    dmg.restore();
    makeParticles(x, y, 40, 7, "#e8edf5");
    sfxBoom();
    shakeT = 1;
  }

  // --- Events ---
  function setWeapon(name) {
    weapon = name;
    document.querySelectorAll(".weapon").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.weapon === name);
    });
  }
  document.querySelectorAll(".weapon").forEach(btn => {
    btn.addEventListener("click", () => setWeapon(btn.dataset.weapon));
  });
  setWeapon("gun");

  function pointerPos(ev) {
    const rect = canvas.getBoundingClientRect();
    if (ev.touches && ev.touches[0]) {
      return {
        x: (ev.touches[0].clientX - rect.left),
        y: (ev.touches[0].clientY - rect.top)
      };
    } else {
      return {
        x: (ev.clientX - rect.left),
        y: (ev.clientY - rect.top)
      };
    }
  }

  function onPointerDown(ev) {
    isPointerDown = true;
    const p = pointerPos(ev);
    if (!inImage(p.x, p.y)) return;
    last = p;

    if (weapon === "gun") useGun(p.x, p.y);
    if (weapon === "grenade") useGrenade(p.x, p.y);
    if (weapon === "flamethrower") useFlame(p.x, p.y);

    // Resume audio if browser suspended
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function onPointerMove(ev) {
    if (!isPointerDown) return;
    const p = pointerPos(ev);
    if (!inImage(p.x, p.y)) { last = p; return; }

    if (weapon === "knife") useKnife(last.x, last.y, p.x, p.y);
    if (weapon === "machete") useMachete(last.x, last.y, p.x, p.y);
    if (weapon === "flamethrower") useFlame(p.x, p.y);

    last = p;
  }
  function onPointerUp() {
    isPointerDown = false;
  }

  canvas.addEventListener("mousedown", onPointerDown);
  canvas.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  canvas.addEventListener("touchstart", (e)=>{ onPointerDown(e); e.preventDefault(); }, {passive:false});
  canvas.addEventListener("touchmove",  (e)=>{ onPointerMove(e); e.preventDefault(); }, {passive:false});
  canvas.addEventListener("touchend", onPointerUp);

  // File upload + drag-drop
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) await loadImageFile(file);
  });

  ;["dragenter","dragover"].forEach(type => {
    dropZone.addEventListener(type, e => {
      e.preventDefault(); e.stopPropagation();
      dropZone.style.borderColor = "#4772ff";
    });
  });
  ;["dragleave","drop"].forEach(type => {
    dropZone.addEventListener(type, e => {
      e.preventDefault(); e.stopPropagation();
      dropZone.style.borderColor = "rgba(255,255,255,.15)";
    });
  });
  dropZone.addEventListener("drop", async (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) await loadImageFile(file);
  });

  async function loadImageFile(file) {
    if (!file.type.startsWith("image/")) return;
    const blobURL = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      imageBitmap = await createImageBitmap(img);
      layoutImage();
      hint.style.display = "none";
      URL.revokeObjectURL(blobURL);
      // Clear previous damage/scorch
      dmg.clearRect(0, 0, damage.width, damage.height);
      scr.clearRect(0, 0, scorch.width, scorch.height);
      render();
    };
    img.src = blobURL;
  }

  resetBtn.addEventListener("click", () => {
    if (!imageBitmap) return;
    dmg.clearRect(0, 0, damage.width, damage.height);
    scr.clearRect(0, 0, scorch.width, scorch.height);
    particles = [];
    shakeT = 0;
  });

  saveBtn.addEventListener("click", () => {
    if (!imageBitmap) return;
    // Force one render pass to ensure up-to-date
    const a = document.createElement("a");
    a.download = "email-destroyer.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  window.addEventListener("resize", resize);
  resize();
})();