// Player Controller, Camera, Interaction Raycast, Hand Animation & Hotbar
import { BLOCK_DEFS } from './textures.js';

export class Player {
  constructor(camera, world, physics, sound, scene, THREE) {
    this.camera = camera;
    this.world = world;
    this.physics = physics;
    this.sound = sound;
    this.scene = scene;
    this.THREE = THREE;

    // Position & Velocity
    this.position = new THREE.Vector3(8.5, 24.0, 8.5);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Camera angles
    this.pitch = 0; // Up / Down (-89 to +89 deg)
    this.yaw = 0;   // Left / Right

    // State
    this.onGround = false;
    this.inWater = false;
    this.isFlying = false;
    this.isSprinting = false;
    this.isSneaking = false;
    this.gameMode = 'creative'; // 'creative' or 'survival'
    this.health = 20;
    this.maxHealth = 20;

    // Jump timing for double-tap space (toggle fly)
    this.lastSpacePress = 0;

    // Movement keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      crouch: false,
      sprint: false
    };

    // Hotbar slots (9 slots)
    // Default starting inventory
    this.hotbar = [1, 2, 3, 4, 5, 6, 7, 10, 19];
    this.selectedSlot = 0;

    // Targeted block raycast result
    this.target = null; // { blockX, blockY, blockZ, normalX, normalY, normalZ, blockId }

    // Wireframe selection highlight box
    const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    this.selectionBox = new THREE.Mesh(boxGeo, boxMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    // First person hand model & held block
    this.createHandModel();

    // Hand animation state
    this.swingProgress = 0;
    this.isSwinging = false;
    this.bobTimer = 0;

    // Find safe spawn height
    this.findSafeSpawn();
  }

  findSafeSpawn() {
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    let topY = 20;
    for (let y = 45; y >= 1; y--) {
      if (this.physics.isSolid(x, y, z)) {
        topY = y + 1;
        break;
      }
    }
    this.position.set(x + 0.5, topY + 0.5, z + 0.5);
  }

  createHandModel() {
    this.handPivot = new this.THREE.Group();

    // Arm (Steve skin color)
    const armGeo = new this.THREE.BoxGeometry(0.2, 0.5, 0.2);
    const armMat = new this.THREE.MeshLambertMaterial({ color: 0xd49678 });
    this.armMesh = new this.THREE.Mesh(armGeo, armMat);
    this.armMesh.position.set(0.32, -0.32, -0.5);
    this.armMesh.rotation.set(-0.35, -0.15, 0.25);
    this.handPivot.add(this.armMesh);

    // Mini held block on hand
    const blockGeo = new this.THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.heldBlockMesh = new this.THREE.Mesh(blockGeo, this.world.opaqueMaterial);
    this.heldBlockMesh.position.set(0.26, -0.22, -0.55);
    this.heldBlockMesh.rotation.set(0.2, 0.5, -0.2);
    this.handPivot.add(this.heldBlockMesh);

    this.camera.add(this.handPivot);
    this.scene.add(this.camera);
  }

  // Trigger arm punch / swing animation
  swingArm() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  updateHandAnimation(dt, isMoving) {
    // Punch / swing animation
    if (this.isSwinging) {
      this.swingProgress += dt * 8.0;
      if (this.swingProgress >= 1.0) {
        this.swingProgress = 0;
        this.isSwinging = false;
      }
    }

    const swingAngle = Math.sin(this.swingProgress * Math.PI) * 0.45;

    // Walking bobbing
    if (isMoving && this.onGround && !this.isFlying) {
      this.bobTimer += dt * (this.isSprinting ? 12 : 8);
    } else {
      this.bobTimer *= 0.85; // Smooth return to rest
    }

    const bobX = Math.cos(this.bobTimer * 0.5) * 0.025;
    const bobY = Math.abs(Math.sin(this.bobTimer)) * 0.035;

    // Apply hand offsets
    this.handPivot.position.set(bobX, -bobY + (swingAngle * 0.1), -swingAngle * 0.15);
    this.handPivot.rotation.set(swingAngle, -swingAngle * 0.5, swingAngle * 0.4);
  }

  getSelectedBlock() {
    return this.hotbar[this.selectedSlot];
  }

  setSelectedSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 9) {
      this.selectedSlot = slotIndex;
      this.updateHeldBlockMesh();
      this.sound.playPop();
    }
  }

  updateHeldBlockMesh() {
    const blockId = this.getSelectedBlock();
    if (!blockId || blockId === 0) {
      this.heldBlockMesh.visible = false;
      return;
    }
    this.heldBlockMesh.visible = true;

    const def = BLOCK_DEFS[blockId];
    if (!def) return;

    const topTile = (def.top !== undefined) ? def.top : (def.all !== undefined ? def.all : 0);
    const btmTile = (def.bottom !== undefined) ? def.bottom : (def.all !== undefined ? def.all : 0);
    const sideTile = (def.side !== undefined) ? def.side : (def.all !== undefined ? def.all : 0);

    const uvTop = this.world.textureGen.getUVs(topTile);
    const uvBtm = this.world.textureGen.getUVs(btmTile);
    const uvSide = this.world.textureGen.getUVs(sideTile);

    const uvs = [
      // +X
      uvSide.u0, uvSide.v1,  uvSide.u1, uvSide.v1,  uvSide.u0, uvSide.v0,  uvSide.u1, uvSide.v0,
      // -X
      uvSide.u0, uvSide.v1,  uvSide.u1, uvSide.v1,  uvSide.u0, uvSide.v0,  uvSide.u1, uvSide.v0,
      // +Y (Top)
      uvTop.u0, uvTop.v1,   uvTop.u1, uvTop.v1,   uvTop.u0, uvTop.v0,   uvTop.u1, uvTop.v0,
      // -Y (Bottom)
      uvBtm.u0, uvBtm.v1,   uvBtm.u1, uvBtm.v1,   uvBtm.u0, uvBtm.v0,   uvBtm.u1, uvBtm.v0,
      // +Z
      uvSide.u0, uvSide.v1,  uvSide.u1, uvSide.v1,  uvSide.u0, uvSide.v0,  uvSide.u1, uvSide.v0,
      // -Z
      uvSide.u0, uvSide.v1,  uvSide.u1, uvSide.v1,  uvSide.u0, uvSide.v0,  uvSide.u1, uvSide.v0
    ];

    const uvAttr = this.heldBlockMesh.geometry.getAttribute('uv');
    if (uvAttr) {
      uvAttr.copyArray(new Float32Array(uvs));
      uvAttr.needsUpdate = true;
    }
  }

  // Pointer look delta
  onMouseMove(movementX, movementY) {
    const sensitivity = 0.0022;
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;

    // Clamp pitch between -89 and +89 degrees
    const maxPitch = (Math.PI / 2) - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  // Fast 3D Raycasting with Voxel DDA Algorithm
  raycastTarget(maxDistance = 5.5) {
    const eyeX = this.position.x;
    const eyeY = this.position.y + this.physics.eyeHeight;
    const eyeZ = this.position.z;

    const dirX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const dirY = Math.sin(this.pitch);
    const dirZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

    let x = Math.floor(eyeX);
    let y = Math.floor(eyeY);
    let z = Math.floor(eyeZ);

    const stepX = Math.sign(dirX);
    const stepY = Math.sign(dirY);
    const stepZ = Math.sign(dirZ);

    const tDeltaX = dirX !== 0 ? Math.abs(1.0 / dirX) : Infinity;
    const tDeltaY = dirY !== 0 ? Math.abs(1.0 / dirY) : Infinity;
    const tDeltaZ = dirZ !== 0 ? Math.abs(1.0 / dirZ) : Infinity;

    let tMaxX = dirX > 0 ? (x + 1 - eyeX) * tDeltaX : (eyeX - x) * tDeltaX;
    let tMaxY = dirY > 0 ? (y + 1 - eyeY) * tDeltaY : (eyeY - y) * tDeltaY;
    let tMaxZ = dirZ > 0 ? (z + 1 - eyeZ) * tDeltaZ : (eyeZ - z) * tDeltaZ;

    let normalX = 0, normalY = 0, normalZ = 0;
    let traveledDist = 0;

    while (traveledDist <= maxDistance) {
      const blockId = this.world.getBlock(x, y, z);
      const def = BLOCK_DEFS[blockId];

      if (blockId !== 0 && def && def.solid) {
        // Hit a solid block!
        return {
          hit: true,
          blockX: x,
          blockY: y,
          blockZ: z,
          normalX,
          normalY,
          normalZ,
          blockId
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          traveledDist = tMaxX;
          tMaxX += tDeltaX;
          normalX = -stepX;
          normalY = 0;
          normalZ = 0;
        } else {
          z += stepZ;
          traveledDist = tMaxZ;
          tMaxZ += tDeltaZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          traveledDist = tMaxY;
          tMaxY += tDeltaY;
          normalX = 0;
          normalY = -stepY;
          normalZ = 0;
        } else {
          z += stepZ;
          traveledDist = tMaxZ;
          tMaxZ += tDeltaZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      }
    }

    return null; // Nothing hit
  }

  // Handle Breaking targeted block
  breakBlock(particles) {
    if (!this.target) return;
    this.swingArm();

    const { blockX, blockY, blockZ, blockId } = this.target;

    // Bedrock cannot be destroyed
    if (blockId === 12 && this.gameMode === 'survival') {
      return;
    }

    // Play crunch sound
    this.sound.playBlockBreak(blockId);

    // Spawn 3D particle debris burst
    if (particles) {
      particles.spawnBlockBreakParticles(blockX + 0.5, blockY + 0.5, blockZ + 0.5, blockId);
    }

    // Destroy block in world
    this.world.setBlock(blockX, blockY, blockZ, 0);
  }

  // Handle Placing block from selected hotbar slot
  placeBlock() {
    if (!this.target) return;
    const selectedBlock = this.getSelectedBlock();
    if (!selectedBlock || selectedBlock === 0) return;

    this.swingArm();

    const placeX = this.target.blockX + this.target.normalX;
    const placeY = this.target.blockY + this.target.normalY;
    const placeZ = this.target.blockZ + this.target.normalZ;

    // Collision Check: Prevent placing inside player bounding box!
    const r = this.physics.playerRadius;
    const h = this.physics.playerHeight;
    const playerMinX = this.position.x - r;
    const playerMaxX = this.position.x + r;
    const playerMinY = this.position.y;
    const playerMaxY = this.position.y + h;
    const playerMinZ = this.position.z - r;
    const playerMaxZ = this.position.z + r;

    const blockMinX = placeX;
    const blockMaxX = placeX + 1;
    const blockMinY = placeY;
    const blockMaxY = placeY + 1;
    const blockMinZ = placeZ;
    const blockMaxZ = placeZ + 1;

    const overlapsPlayer = (
      playerMinX < blockMaxX && playerMaxX > blockMinX &&
      playerMinY < blockMaxY && playerMaxY > blockMinY &&
      playerMinZ < blockMaxZ && playerMaxZ > blockMinZ
    );

    if (overlapsPlayer && !this.isFlying) {
      return; // Cannot place block inside player
    }

    // Set block
    this.world.setBlock(placeX, placeY, placeZ, selectedBlock);
    this.sound.playBlockPlace(selectedBlock);
  }

  // Pick block under cursor
  pickBlock() {
    if (!this.target) return;
    const id = this.target.blockId;
    if (id === 0) return;

    // Check if already in hotbar
    const existingSlot = this.hotbar.indexOf(id);
    if (existingSlot !== -1) {
      this.selectedSlot = existingSlot;
    } else {
      // Put in active slot
      this.hotbar[this.selectedSlot] = id;
    }
    this.sound.playPop();
  }

  update(dt, particles) {
    // 1. Calculate movement vectors based on yaw
    let moveForward = 0;
    let moveRight = 0;

    if (this.keys.forward) moveForward += 1;
    if (this.keys.backward) moveForward -= 1;
    if (this.keys.left) moveRight -= 1;
    if (this.keys.right) moveRight += 1;

    const isMoving = (moveForward !== 0 || moveRight !== 0);

    // Speed calculation
    let speed = 4.8; // m/s default walking speed
    if (this.isSprinting && this.onGround) speed = 7.5;
    if (this.isSneaking && this.onGround) speed = 2.4;
    if (this.isFlying) speed = 12.0;

    if (isMoving) {
      // Normalized direction vector on local axes (X: right, Z: forward)
      const len = Math.hypot(moveForward, moveRight);
      const inputForward = moveForward / len;
      const inputRight = moveRight / len;

      // In Three.js with yaw:
      // Looking direction forward on XZ plane: (-sin(yaw), -cos(yaw))
      // Perpendicular right direction on XZ plane: (cos(yaw), -sin(yaw))
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      const fwdX = -sinY;
      const fwdZ = -cosY;
      const rgtX = cosY;
      const rgtZ = -sinY;

      // World movement delta
      const worldDx = (fwdX * inputForward + rgtX * inputRight) * speed;
      const worldDz = (fwdZ * inputForward + rgtZ * inputRight) * speed;

      // Smooth Acceleration
      const accel = this.onGround ? 0.45 : 0.2;
      this.velocity.x += (worldDx - this.velocity.x) * accel;
      this.velocity.z += (worldDz - this.velocity.z) * accel;

      // Footstep sound
      if (this.onGround && !this.isFlying) {
        const blockBelow = this.world.getBlock(
          Math.floor(this.position.x),
          Math.floor(this.position.y - 0.2),
          Math.floor(this.position.z)
        );
        this.sound.playFootstep(blockBelow || 1);
      }
    }

    // 2. Jump
    if (this.keys.jump && this.onGround && !this.isFlying) {
      this.velocity.y = 9.2; // ~1.25 blocks jump
      this.onGround = false;
      this.sound.playJump();
    }

    // 3. Update Physics & Collision
    this.physics.update(this, dt);

    // 4. Update Camera Position & Rotation
    this.camera.position.set(
      this.position.x,
      this.position.y + this.physics.eyeHeight,
      this.position.z
    );

    // Euler rotation: Y (yaw) then X (pitch)
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Dynamic FOV for sprinting
    const targetFOV = this.isSprinting ? 78 : 70;
    this.camera.fov += (targetFOV - this.camera.fov) * dt * 8.0;
    this.camera.updateProjectionMatrix();

    // 5. Update Targeted Block Raycast
    this.target = this.raycastTarget(5.5);
    if (this.target) {
      this.selectionBox.visible = true;
      this.selectionBox.position.set(
        this.target.blockX + 0.5,
        this.target.blockY + 0.5,
        this.target.blockZ + 0.5
      );
    } else {
      this.selectionBox.visible = false;
    }

    // 6. Update Hand Animation
    this.updateHandAnimation(dt, isMoving);
  }
}
