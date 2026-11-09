// Physics Engine: AABB swept voxel collision, auto-stepping, water buoyancy & flight
import { BLOCK_DEFS } from './textures.js';

export class Physics {
  constructor(world) {
    this.world = world;
    this.gravity = 28.0; // m/s^2
    this.playerRadius = 0.3; // Total width 0.6
    this.playerHeight = 1.8;
    this.eyeHeight = 1.62;
    this.stepHeight = 1.05; // Auto-step onto 1-block steps smoothly
  }

  // Check if a block is solid for collision
  isSolid(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    const def = BLOCK_DEFS[id];
    return def ? def.solid : false;
  }

  // Check if position is in liquid (Water)
  isLiquid(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    const def = BLOCK_DEFS[id];
    return def ? !!def.isLiquid : false;
  }

  // Check if an AABB intersects any solid block in the world
  checkAABBCollision(minX, minY, minZ, maxX, maxY, maxZ) {
    const startX = Math.floor(minX);
    const endX = Math.floor(maxX);
    const startY = Math.floor(minY);
    const endY = Math.floor(maxY);
    const startZ = Math.floor(minZ);
    const endZ = Math.floor(maxZ);

    for (let y = startY; y <= endY; y++) {
      for (let z = startZ; z <= endZ; z++) {
        for (let x = startX; x <= endX; x++) {
          if (this.isSolid(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if the player is currently standing over air (for sneak ledge protection)
  isLedge(pos, dx, dz) {
    const testX = pos.x + dx;
    const testZ = pos.z + dz;
    const testY = pos.y - 0.05;
    
    // If there is ANY solid block supporting the player at test position
    return !this.checkAABBCollision(
      testX - this.playerRadius,
      testY - 0.5,
      testZ - this.playerRadius,
      testX + this.playerRadius,
      testY,
      testZ + this.playerRadius
    );
  }

  // Update player position with collision resolution
  update(player, dt) {
    // Max delta time clamp to prevent tunneling during lag spikes
    const clampedDt = Math.min(dt, 0.05);

    const pos = player.position;
    const vel = player.velocity;

    // Check if player is submerged in water
    const blockAtFeet = this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y + 0.2), Math.floor(pos.z));
    const blockAtHead = this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y + this.eyeHeight), Math.floor(pos.z));
    const inWater = (blockAtFeet === 11 || blockAtHead === 11);
    player.inWater = inWater;

    // Creative Flight Mode
    if (player.isFlying) {
      vel.y = 0;
      if (player.keys.jump) vel.y = 10.0;
      if (player.keys.crouch) vel.y = -10.0;

      pos.x += vel.x * clampedDt;
      pos.y += vel.y * clampedDt;
      pos.z += vel.z * clampedDt;

      // Friction
      vel.x *= 0.85;
      vel.z *= 0.85;
      return;
    }

    // Apply Water Buoyancy / Drag OR Gravity
    if (inWater) {
      vel.y -= this.gravity * 0.25 * clampedDt;
      if (player.keys.jump) {
        vel.y = 4.0; // Swim up
      } else if (player.keys.crouch) {
        vel.y = -4.0; // Sink down
      } else {
        vel.y *= 0.85; // Water resistance
      }
      vel.x *= 0.8;
      vel.z *= 0.8;
    } else {
      // Normal Gravity
      vel.y -= this.gravity * clampedDt;
      // Terminate terminal velocity
      if (vel.y < -45.0) vel.y = -45.0;
    }

    let dx = vel.x * clampedDt;
    let dy = vel.y * clampedDt;
    let dz = vel.z * clampedDt;

    // Crouch / Sneak Ledge Protection
    if (player.isSneaking && player.onGround) {
      if (dx !== 0 && this.isLedge(pos, dx, 0)) {
        dx = 0;
        vel.x = 0;
      }
      if (dz !== 0 && this.isLedge(pos, 0, dz)) {
        dz = 0;
        vel.z = 0;
      }
    }

    const r = this.playerRadius;
    const h = this.playerHeight;

    // 1. Resolve Y Axis (Vertical)
    const newY = pos.y + dy;
    let yHit = false;

    if (dy < 0) { // Falling down
      const startX = Math.floor(pos.x - r + 0.001);
      const endX = Math.floor(pos.x + r - 0.001);
      const startZ = Math.floor(pos.z - r + 0.001);
      const endZ = Math.floor(pos.z + r - 0.001);
      const targetY = Math.floor(newY);

      for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
          if (this.isSolid(x, targetY, z)) {
            // Hit ground
            pos.y = targetY + 1.0;
            vel.y = 0;
            player.onGround = true;
            yHit = true;
            break;
          }
        }
        if (yHit) break;
      }
      if (!yHit) {
        pos.y = newY;
        player.onGround = false;
      }
    } else if (dy > 0) { // Jumping up
      const startX = Math.floor(pos.x - r + 0.001);
      const endX = Math.floor(pos.x + r - 0.001);
      const startZ = Math.floor(pos.z - r + 0.001);
      const endZ = Math.floor(pos.z + r - 0.001);
      const targetY = Math.floor(newY + h);

      for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
          if (this.isSolid(x, targetY, z)) {
            // Hit ceiling
            pos.y = targetY - h - 0.001;
            vel.y = 0;
            yHit = true;
            break;
          }
        }
        if (yHit) break;
      }
      if (!yHit) {
        pos.y = newY;
        player.onGround = false;
      }
    }

    // 2. Resolve X Axis (Horizontal with Auto-Step)
    if (dx !== 0) {
      const stepSuccess = this.tryMoveWithStep(pos, dx, 0, r, h, player.onGround);
      if (!stepSuccess) {
        // Direct collision without step
        const signX = Math.sign(dx);
        const testX = pos.x + dx + (signX * r);
        const targetX = Math.floor(testX);
        const startY = Math.floor(pos.y + 0.01);
        const endY = Math.floor(pos.y + h - 0.01);
        const startZ = Math.floor(pos.z - r + 0.001);
        const endZ = Math.floor(pos.z + r - 0.001);

        let xCollision = false;
        for (let y = startY; y <= endY; y++) {
          for (let z = startZ; z <= endZ; z++) {
            if (this.isSolid(targetX, y, z)) {
              xCollision = true;
              break;
            }
          }
          if (xCollision) break;
        }

        if (xCollision) {
          if (signX > 0) pos.x = targetX - r - 0.001;
          else pos.x = targetX + 1.0 + r + 0.001;
          vel.x = 0;
        } else {
          pos.x += dx;
        }
      }
    }

    // 3. Resolve Z Axis (Horizontal with Auto-Step)
    if (dz !== 0) {
      const stepSuccess = this.tryMoveWithStep(pos, 0, dz, r, h, player.onGround);
      if (!stepSuccess) {
        const signZ = Math.sign(dz);
        const testZ = pos.z + dz + (signZ * r);
        const targetZ = Math.floor(testZ);
        const startY = Math.floor(pos.y + 0.01);
        const endY = Math.floor(pos.y + h - 0.01);
        const startX = Math.floor(pos.x - r + 0.001);
        const endX = Math.floor(pos.x + r - 0.001);

        let zCollision = false;
        for (let y = startY; y <= endY; y++) {
          for (let x = startX; x <= endX; x++) {
            if (this.isSolid(x, y, targetZ)) {
              zCollision = true;
              break;
            }
          }
          if (zCollision) break;
        }

        if (zCollision) {
          if (signZ > 0) pos.z = targetZ - r - 0.001;
          else pos.z = targetZ + 1.0 + r + 0.001;
          vel.z = 0;
        } else {
          pos.z += dz;
        }
      }
    }

    // Horizontal friction
    const friction = player.onGround ? 0.65 : 0.92;
    vel.x *= friction;
    vel.z *= friction;
  }

  // Smooth Auto-Step onto 1-block obstacles
  tryMoveWithStep(pos, dx, dz, r, h, onGround) {
    if (!onGround) return false;

    // Check if normal move collides
    const directCollides = this.checkAABBCollision(
      pos.x + dx - r, pos.y, pos.z + dz - r,
      pos.x + dx + r, pos.y + h, pos.z + dz + r
    );

    if (!directCollides) {
      pos.x += dx;
      pos.z += dz;
      return true;
    }

    // Try stepped movement (lift up by 1 block, move forward, step down)
    const stepUpY = pos.y + this.stepHeight;
    // Check if headroom exists
    const headroomCollides = this.checkAABBCollision(
      pos.x - r, pos.y, pos.z - r,
      pos.x + r, stepUpY + h, pos.z + r
    );
    if (headroomCollides) return false;

    // Check if elevated forward space is clear
    const elevatedCollides = this.checkAABBCollision(
      pos.x + dx - r, stepUpY, pos.z + dz - r,
      pos.x + dx + r, stepUpY + h, pos.z + dz + r
    );
    if (elevatedCollides) return false;

    // Find new ground level at stepped position
    let targetGroundY = pos.y;
    for (let testY = Math.floor(stepUpY); testY >= Math.floor(pos.y); testY--) {
      const collides = this.checkAABBCollision(
        pos.x + dx - r, testY, pos.z + dz - r,
        pos.x + dx + r, testY + 0.01, pos.z + dz + r
      );
      if (collides) {
        targetGroundY = testY + 1.0;
        break;
      }
    }

    pos.x += dx;
    pos.y = targetGroundY;
    pos.z += dz;
    return true;
  }
}

