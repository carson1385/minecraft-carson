// Main Game Engine: Day/Night Cycle, Clouds, Particles, TNT Mechanics, HUD & UI
import { TextureGenerator, BLOCK_DEFS } from './textures.js';
import { SoundEngine } from './audio.js';
import { World } from './world.js';
import { Physics } from './physics.js';
import { Player } from './player.js';

// Particle System for block destruction & TNT explosions
class ParticleSystem {
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    this.maxParticles = 300;
    this.particles = [];

    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: false, color: 0xffffff });
    this.meshInst = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.meshInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.meshInst);

    this.dummy = new THREE.Object3D();

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        rotX: 0, rotY: 0,
        vRotX: 0, vRotY: 0,
        life: 0,
        maxLife: 1.0,
        scale: 1.0
      });
    }
  }

  spawnBlockBreakParticles(bx, by, bz, blockId) {
    const count = 14;
    let spawned = 0;

    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = bx + (Math.random() - 0.5) * 0.6;
        p.y = by + (Math.random() - 0.5) * 0.6;
        p.z = bz + (Math.random() - 0.5) * 0.6;
        p.vx = (Math.random() - 0.5) * 4.5;
        p.vy = Math.random() * 4.0 + 1.0;
        p.vz = (Math.random() - 0.5) * 4.5;
        p.rotX = Math.random() * Math.PI;
        p.rotY = Math.random() * Math.PI;
        p.vRotX = (Math.random() - 0.5) * 10;
        p.vRotY = (Math.random() - 0.5) * 10;
        p.life = 0;
        p.maxLife = 0.5 + Math.random() * 0.4;
        p.scale = 0.8 + Math.random() * 0.5;
        spawned++;
      }
    }
  }

  update(dt) {
    let activeCount = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.meshInst.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Physics
      p.vy -= 18.0 * dt; // Gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotX += p.vRotX * dt;
      p.rotY += p.vRotY * dt;

      // Fade scale
      const progress = p.life / p.maxLife;
      const curScale = p.scale * (1.0 - progress);

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rotX, p.rotY, 0);
      this.dummy.scale.set(curScale, curScale, curScale);
      this.dummy.updateMatrix();
      this.meshInst.setMatrixAt(i, this.dummy.matrix);

      activeCount++;
    }
    this.meshInst.instanceMatrix.needsUpdate = true;
  }
}

// Active TNT entity that flashes and explodes
class TNTEntity {
  constructor(x, y, z, scene, world, sound, particles, player, THREE) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.particles = particles;
    this.player = player;
    this.THREE = THREE;
    this.fuseTime = 2.5; // seconds
    this.elapsed = 0;
    this.isDone = false;

    // Create flashing TNT block mesh
    const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(this.mesh);

    this.sound.playTNTFuse();
  }

  update(dt) {
    if (this.isDone) return;
    this.elapsed += dt;

    // Flash white and scale up
    const flashFreq = 6;
    const isWhite = Math.sin(this.elapsed * flashFreq * Math.PI) > 0;
    this.mat.color.setHex(isWhite ? 0xffffff : 0xff3333);

    const scale = 1.0 + (this.elapsed / this.fuseTime) * 0.15;
    this.mesh.scale.set(scale, scale, scale);

    if (this.elapsed >= this.fuseTime) {
      this.explode();
    }
  }

  explode() {
    this.isDone = true;
    this.scene.remove(this.mesh);
    this.sound.playExplosion();

    // Destroy blocks in 3.5 block radius
    const radius = 3.5;
    const cx = Math.floor(this.x);
    const cy = Math.floor(this.y);
    const cz = Math.floor(this.z);
    const dirtyChunks = new Set();

    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
        for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
          const dist = Math.hypot(dx, dy, dz);
          if (dist <= radius) {
            const bx = cx + dx;
            const by = cy + dy;
            const bz = cz + dz;
            const bId = this.world.getBlock(bx, by, bz);
            if (bId !== 0 && bId !== 12) { // Cannot destroy Bedrock
              this.world.setBlock(bx, by, bz, 0, true, false);
              
              const chX = Math.floor(bx / 16);
              const chZ = Math.floor(bz / 16);
              dirtyChunks.add(this.world.getChunkKey(chX, chZ));

              if (Math.random() < 0.25) {
                this.particles.spawnBlockBreakParticles(bx + 0.5, by + 0.5, bz + 0.5, bId);
              }
            }
          }
        }
      }
    }

    // Remesh each affected chunk only once for max performance (zero lag)
    for (const key of dirtyChunks) {
      const [chX, chZ] = key.split(',').map(Number);
      const ch = this.world.getChunk(chX, chZ);
      if (ch) this.world.updateChunkMesh(ch);
    }

    // Knockback player if nearby
    const pDist = this.player.position.distanceTo(new this.THREE.Vector3(cx + 0.5, cy + 0.5, cz + 0.5));
    if (pDist < radius * 2.5) {
      const dir = new this.THREE.Vector3().subVectors(this.player.position, new this.THREE.Vector3(cx, cy, cz)).normalize();
      const force = Math.max(0, (radius * 2.5 - pDist) * 3.5);
      this.player.velocity.x += dir.x * force;
      this.player.velocity.y += Math.max(6.0, dir.y * force);
      this.player.velocity.z += dir.z * force;
    }
  }
}

export class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.THREE = window.THREE;

    // Renderer
    this.renderer = new this.THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x73afff);
    this.container.appendChild(this.renderer.domElement);

    // Scene & Camera
    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);

    // Fog for smooth chunk borders
    this.scene.fog = new this.THREE.FogExp2(0x73afff, 0.015);

    // Modules
    this.textureGen = new TextureGenerator();
    this.sound = new SoundEngine();
    this.world = new World(this.scene, this.textureGen, this.THREE);
    this.physics = new Physics(this.world);
    this.player = new Player(this.camera, this.world, this.physics, this.sound, this.scene, this.THREE);
    this.particles = new ParticleSystem(this.scene, this.THREE);

    // Lighting & Environment
    this.setupLighting();
    this.setupSkyAndClouds();

    // Active TNT entities
    this.tntEntities = [];

    // Timing & FPS
    this.clock = new this.THREE.Clock();
    this.fpsTimer = 0;
    this.frameCount = 0;
    this.fps = 60;

    // Day/Night cycle
    this.timeOfDay = 0.25; // 0 to 1 (0.25 = noon, 0.75 = midnight)
    this.daySpeed = 0.005; // 1 full day ~ 200 seconds

    // UI Elements
    this.setupUI();
    this.bindEvents();

    // Generate initial world chunks
    this.world.generateWorld();

    // Render hotbar icons & init held block
    this.updateHotbarUI();
    this.player.updateHeldBlockMesh();
    this.buildInventoryGrid();

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    this.ambientLight = new this.THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.sunLight = new this.THREE.DirectionalLight(0xfff4e0, 0.85);
    this.sunLight.position.set(50, 100, 50);
    this.scene.add(this.sunLight);
  }

  setupSkyAndClouds() {
    // Sun Visual (Flat glowing billboard)
    const sunGeo = new this.THREE.PlaneGeometry(16, 16);
    const sunMat = new this.THREE.MeshBasicMaterial({ color: 0xffffee, side: this.THREE.DoubleSide });
    this.sunMesh = new this.THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Moon Visual
    const moonGeo = new this.THREE.PlaneGeometry(12, 12);
    const moonMat = new this.THREE.MeshBasicMaterial({ color: 0xddddf0, side: this.THREE.DoubleSide });
    this.moonMesh = new this.THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    // Stars at Night
    const starCount = 350;
    const starGeo = new this.THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 240;
      starPos.push(
        r * Math.sin(phi) * Math.cos(theta),
        Math.abs(r * Math.cos(phi)) + 15, // Upper hemisphere
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    starGeo.setAttribute('position', new this.THREE.Float32BufferAttribute(starPos, 3));
    this.starMat = new this.THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0 });
    this.starPoints = new this.THREE.Points(starGeo, this.starMat);
    this.scene.add(this.starPoints);

    // Minecraft Voxel Clouds (layer at y = 44)
    const cloudGeo = new this.THREE.PlaneGeometry(300, 300);
    const cloudMat = new this.THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      side: this.THREE.DoubleSide
    });
    this.cloudsMesh = new this.THREE.Mesh(cloudGeo, cloudMat);
    this.cloudsMesh.position.set(0, 44, 0);
    this.cloudsMesh.rotation.x = Math.PI / 2;
    this.scene.add(this.cloudsMesh);
  }

  updateSkyAndLighting(dt) {
    this.timeOfDay = (this.timeOfDay + this.daySpeed * dt) % 1.0;

    const angle = this.timeOfDay * Math.PI * 2;
    const sunDist = 180;
    const sunX = Math.sin(angle) * sunDist;
    const sunY = Math.cos(angle) * sunDist;

    // Sun & Moon Positions
    this.sunMesh.position.set(
      this.player.position.x + sunX,
      this.player.position.y + sunY,
      this.player.position.z
    );
    this.sunMesh.lookAt(this.player.position);

    this.moonMesh.position.set(
      this.player.position.x - sunX,
      this.player.position.y - sunY,
      this.player.position.z
    );
    this.moonMesh.lookAt(this.player.position);

    // Sun light direction
    this.sunLight.position.set(sunX, sunY, 50);

    // Sky & Fog Color Transitions
    const noonColor = new this.THREE.Color(0x73afff);
    const sunsetColor = new this.THREE.Color(0xdc7850);
    const nightColor = new this.THREE.Color(0x0a1020);

    let skyColor = new this.THREE.Color();
    const sunElev = Math.cos(angle);

    if (sunElev > 0.2) {
      // Day
      skyColor.copy(noonColor);
      this.ambientLight.intensity = 0.55 + sunElev * 0.2;
      this.sunLight.intensity = 0.85 * sunElev;
      this.starMat.opacity = 0;
    } else if (sunElev > -0.2) {
      // Twilight / Sunset / Sunrise
      const t = (sunElev + 0.2) / 0.4;
      skyColor.lerpColors(sunsetColor, noonColor, t);
      this.ambientLight.intensity = 0.35;
      this.sunLight.intensity = 0.3;
      this.starMat.opacity = (1.0 - t) * 0.8;
    } else {
      // Night
      skyColor.copy(nightColor);
      this.ambientLight.intensity = 0.18;
      this.sunLight.intensity = 0.1;
      this.starMat.opacity = 0.9;
    }

    this.renderer.setClearColor(skyColor);
    this.scene.fog.color.copy(skyColor);

    // Drift clouds
    this.cloudsMesh.position.x = this.player.position.x + (performance.now() * 0.002) % 300;
    this.cloudsMesh.position.z = this.player.position.z;
    this.starPoints.position.copy(this.player.position);
  }

  setupUI() {
    this.hudCoords = document.getElementById('hud-coords');
    this.hudFps = document.getElementById('hud-fps');
    this.hudBlock = document.getElementById('hud-block');
    this.hotbarContainer = document.getElementById('hotbar');
    this.inventoryModal = document.getElementById('inventory-modal');
    this.pauseModal = document.getElementById('pause-modal');
    this.blockNameTooltip = document.getElementById('block-tooltip');
  }

  updateHotbarUI() {
    this.hotbarContainer.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = `hotbar-slot ${i === this.player.selectedSlot ? 'active' : ''}`;
      const blockId = this.player.hotbar[i];
      if (blockId && blockId > 0) {
        const iconCanvas = this.textureGen.tileCanvases[BLOCK_DEFS[blockId].all || BLOCK_DEFS[blockId].top || BLOCK_DEFS[blockId].side || 0];
        if (iconCanvas) {
          const img = document.createElement('img');
          img.src = iconCanvas.toDataURL();
          img.className = 'slot-icon';
          slot.appendChild(img);
        }
      }
      const numLabel = document.createElement('span');
      numLabel.className = 'slot-number';
      numLabel.innerText = i + 1;
      slot.appendChild(numLabel);

      slot.addEventListener('click', () => {
        this.player.setSelectedSlot(i);
        this.updateHotbarUI();
      });

      this.hotbarContainer.appendChild(slot);
    }

    const curBlock = BLOCK_DEFS[this.player.getSelectedBlock()];
    if (curBlock && this.hudBlock) {
      this.hudBlock.innerText = curBlock.name;
    }
  }

  buildInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let id = 1; id <= 24; id++) {
      const def = BLOCK_DEFS[id];
      if (!def) continue;

      const item = document.createElement('div');
      item.className = 'inventory-item';
      item.title = def.name;

      const iconCanvas = this.textureGen.tileCanvases[def.all || def.top || def.side || 0];
      if (iconCanvas) {
        const img = document.createElement('img');
        img.src = iconCanvas.toDataURL();
        img.className = 'inv-icon';
        item.appendChild(img);
      }

      const label = document.createElement('span');
      label.className = 'inv-label';
      label.innerText = def.name;
      item.appendChild(label);

      item.addEventListener('click', () => {
        this.player.hotbar[this.player.selectedSlot] = id;
        this.player.updateHeldBlockMesh();
        this.updateHotbarUI();
        this.sound.playPop();
        this.toggleInventory(false);
      });

      grid.appendChild(item);
    }
  }

  toggleInventory(forceState) {
    const isOpen = (forceState !== undefined) ? forceState : !this.inventoryModal.classList.contains('active');
    if (isOpen) {
      document.exitPointerLock();
      this.inventoryModal.classList.add('active');
    } else {
      this.inventoryModal.classList.remove('active');
      this.container.requestPointerLock();
    }
  }

  togglePauseMenu(forceState) {
    const isOpen = (forceState !== undefined) ? forceState : !this.pauseModal.classList.contains('active');
    if (isOpen) {
      document.exitPointerLock();
      this.pauseModal.classList.add('active');
    } else {
      this.pauseModal.classList.remove('active');
      this.container.requestPointerLock();
    }
  }

  bindEvents() {
    // Click on canvas to lock pointer
    this.container.addEventListener('click', (e) => {
      if (document.pointerLockElement !== this.container) {
        this.sound.init();
        this.container.requestPointerLock();
      }
    });

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === this.container;
      const blocker = document.getElementById('blocker');
      if (blocker) {
        blocker.style.display = isLocked ? 'none' : 'flex';
      }
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.container) {
        this.player.onMouseMove(e.movementX, e.movementY);
      }
    });

    // Mouse buttons (Left: Break, Right: Place, Middle: Pick)
    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.container) return;

      if (e.button === 0) { // Left Click: Break
        if (this.player.target && this.player.target.blockId === 19) {
          // If TNT, ignite!
          const { blockX, blockY, blockZ } = this.player.target;
          this.world.setBlock(blockX, blockY, blockZ, 0);
          this.tntEntities.push(
            new TNTEntity(blockX, blockY, blockZ, this.scene, this.world, this.sound, this.particles, this.player, this.THREE)
          );
        } else {
          this.player.breakBlock(this.particles);
        }
      } else if (e.button === 2) { // Right Click: Place
        this.player.placeBlock();
      } else if (e.button === 1) { // Middle Click: Pick block
        this.player.pickBlock();
        this.player.updateHeldBlockMesh();
        this.updateHotbarUI();
      }
    });

    // Prevent default right-click context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse scroll wheel for hotbar slots
    window.addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== this.container) return;
      let nextSlot = this.player.selectedSlot;
      if (e.deltaY > 0) {
        nextSlot = (this.player.selectedSlot + 1) % 9;
      } else {
        nextSlot = (this.player.selectedSlot + 8) % 9;
      }
      this.player.setSelectedSlot(nextSlot);
      this.updateHotbarUI();
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.toggleInventory();
        return;
      }

      if (e.code === 'Escape') {
        if (this.inventoryModal.classList.contains('active')) {
          this.toggleInventory(false);
        } else {
          this.togglePauseMenu();
        }
        return;
      }

      // Hotbar numbers 1-9
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const slot = parseInt(e.code.replace('Digit', '')) - 1;
        this.player.setSelectedSlot(slot);
        this.updateHotbarUI();
        return;
      }

      switch (e.code) {
        case 'KeyW': this.player.keys.forward = true; break;
        case 'KeyS': this.player.keys.backward = true; break;
        case 'KeyA': this.player.keys.left = true; break;
        case 'KeyD': this.player.keys.right = true; break;
        case 'Space':
          this.player.keys.jump = true;
          // Double-tap space to toggle fly in creative mode
          const now = performance.now();
          if (now - this.player.lastSpacePress < 300) {
            this.player.isFlying = !this.player.isFlying;
            this.player.velocity.set(0, 0, 0);
          }
          this.player.lastSpacePress = now;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.player.keys.crouch = true;
          this.player.isSneaking = true;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.player.isSprinting = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.player.keys.forward = false; break;
        case 'KeyS': this.player.keys.backward = false; break;
        case 'KeyA': this.player.keys.left = false; break;
        case 'KeyD': this.player.keys.right = false; break;
        case 'Space': this.player.keys.jump = false; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.player.keys.crouch = false;
          this.player.isSneaking = false;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.player.isSprinting = false;
          break;
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Bind Pause Menu Buttons
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.togglePauseMenu(false));
    }

    const resetBtn = document.getElementById('btn-reset-world');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Regenerate fresh world? Your custom blocks will reset.')) {
          this.world.resetSavedWorld();
          this.player.findSafeSpawn();
          this.togglePauseMenu(false);
        }
      });
    }

    const flyToggleBtn = document.getElementById('btn-toggle-fly');
    if (flyToggleBtn) {
      flyToggleBtn.addEventListener('click', () => {
        this.player.isFlying = !this.player.isFlying;
        flyToggleBtn.innerText = `Flight: ${this.player.isFlying ? 'ON' : 'OFF'}`;
      });
    }

    const modeBtn = document.getElementById('btn-toggle-mode');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        this.player.gameMode = (this.player.gameMode === 'creative') ? 'survival' : 'creative';
        modeBtn.innerText = `Mode: ${this.player.gameMode.toUpperCase()}`;
      });
    }

    const closeInvBtn = document.getElementById('btn-close-inv');
    if (closeInvBtn) {
      closeInvBtn.addEventListener('click', () => this.toggleInventory(false));
    }

    this.bindTouchEvents();
  }

  bindTouchEvents() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    document.body.classList.add('touch-enabled');

    const bindTouchBtn = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        onDown();
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        onUp();
      }, { passive: false });
    };

    bindTouchBtn('touch-forward', () => { this.player.keys.forward = true; }, () => { this.player.keys.forward = false; });
    bindTouchBtn('touch-back', () => { this.player.keys.backward = true; }, () => { this.player.keys.backward = false; });
    bindTouchBtn('touch-left', () => { this.player.keys.left = true; }, () => { this.player.keys.left = false; });
    bindTouchBtn('touch-right', () => { this.player.keys.right = true; }, () => { this.player.keys.right = false; });

    bindTouchBtn('touch-jump', () => { this.player.keys.jump = true; }, () => { this.player.keys.jump = false; });
    bindTouchBtn('touch-break', () => {
      this.sound.init();
      if (this.player.target && this.player.target.blockId === 19) {
        const { blockX, blockY, blockZ } = this.player.target;
        this.world.setBlock(blockX, blockY, blockZ, 0);
        this.tntEntities.push(
          new TNTEntity(blockX, blockY, blockZ, this.scene, this.world, this.sound, this.particles, this.player, this.THREE)
        );
      } else {
        this.player.breakBlock(this.particles);
      }
    }, () => {});

    bindTouchBtn('touch-place', () => {
      this.sound.init();
      this.player.placeBlock();
    }, () => {});

    bindTouchBtn('touch-fly', () => {
      this.player.isFlying = !this.player.isFlying;
      this.player.velocity.set(0, 0, 0);
    }, () => {});

    bindTouchBtn('touch-inv', () => {
      this.toggleInventory();
    }, () => {});

    // Touch swipe camera look
    let touchStartX = 0;
    let touchStartY = 0;
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        this.player.onMouseMove(dx * 1.5, dy * 1.5);
      }
    }, { passive: true });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();

    // FPS Counter
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round((this.frameCount / this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.hudFps) this.hudFps.innerText = `${this.fps} FPS`;
    }

    // Update Player & Physics
    this.player.update(dt, this.particles);

    // Update Particles
    this.particles.update(dt);

    // Update TNT Entities
    for (let i = this.tntEntities.length - 1; i >= 0; i--) {
      const tnt = this.tntEntities[i];
      tnt.update(dt);
      if (tnt.isDone) {
        this.tntEntities.splice(i, 1);
      }
    }

    // Update Day/Night Cycle, Lighting & Sky
    this.updateSkyAndLighting(dt);

    // Update Coordinates HUD
    if (this.hudCoords) {
      const px = this.player.position.x.toFixed(1);
      const py = this.player.position.y.toFixed(1);
      const pz = this.player.position.z.toFixed(1);
      const flyStr = this.player.isFlying ? ' [FLY]' : '';
      this.hudCoords.innerText = `XYZ: ${px} / ${py} / ${pz}${flyStr}`;
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start Game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
