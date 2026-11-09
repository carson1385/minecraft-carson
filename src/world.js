// World Generation, Chunk Management & Fast Voxel Meshing
import { BLOCK_DEFS } from './textures.js';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_HEIGHT = 48;
export const SEA_LEVEL = 12;

// Fast Simplex Noise implementation
class SimplexNoise {
  constructor(seed = 12345) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    
    // Initialize permutation with seed
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const tmp = this.p[i];
      this.p[i] = this.p[j];
      this.p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }

    this.grad3 = [
      [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
      [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
      [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1]
    ];
  }

  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    let n0 = 0, n1 = 0, n2 = 0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1 = 0, j1 = 0;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const gi0 = this.permMod12[ii + this.perm[jj]];
      n0 = t0 * t0 * (this.grad3[gi0][0] * x0 + this.grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
      n1 = t1 * t1 * (this.grad3[gi1][0] * x1 + this.grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
      n2 = t2 * t2 * (this.grad3[gi2][0] * x2 + this.grad3[gi2][1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }
}

export class Chunk {
  constructor(cx, cz, world) {
    this.cx = cx;
    this.cz = cz;
    this.world = world;
    this.blocks = new Uint8Array(CHUNK_SIZE_X * CHUNK_HEIGHT * CHUNK_SIZE_Z);
    this.opaqueMesh = null;
    this.transparentMesh = null;
    this.isDirty = true;
    this.generated = false;
  }

  getIndex(lx, ly, lz) {
    return lx + lz * CHUNK_SIZE_X + ly * (CHUNK_SIZE_X * CHUNK_SIZE_Z);
  }

  getBlock(lx, ly, lz) {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return 0;
    }
    return this.blocks[this.getIndex(lx, ly, lz)];
  }

  setBlock(lx, ly, lz, id) {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return;
    }
    this.blocks[this.getIndex(lx, ly, lz)] = id;
    this.isDirty = true;
  }
}

export class World {
  constructor(scene, textureGen, THREE) {
    this.scene = scene;
    this.textureGen = textureGen;
    this.THREE = THREE;
    this.chunks = new Map();
    this.noise = new SimplexNoise(42819);
    this.renderDistance = 4; // 9x9 chunk radius (around spawn: -4 to +4)
    this.savedDeltas = {};

    // Materials
    const texture = textureGen.createThreeTexture(THREE);
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      side: THREE.FrontSide
    });

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      alphaTest: 0.1,
      side: THREE.DoubleSide
    });

    this.loadDeltas();
  }

  // Load saved block modifications from localStorage
  loadDeltas() {
    try {
      const data = localStorage.getItem('minecraft_web_deltas');
      if (data) {
        this.savedDeltas = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not load saved world deltas', e);
    }
  }

  saveDelta(x, y, z, id) {
    const key = `${x},${y},${z}`;
    this.savedDeltas[key] = id;
    try {
      localStorage.setItem('minecraft_web_deltas', JSON.stringify(this.savedDeltas));
    } catch (e) {
      console.warn('LocalStorage full or disabled', e);
    }
  }

  resetSavedWorld() {
    this.savedDeltas = {};
    localStorage.removeItem('minecraft_web_deltas');
    // Clear and regenerate all chunks
    for (const chunk of this.chunks.values()) {
      if (chunk.opaqueMesh) this.scene.remove(chunk.opaqueMesh);
      if (chunk.transparentMesh) this.scene.remove(chunk.transparentMesh);
    }
    this.chunks.clear();
    this.generateWorld();
  }

  getChunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  getOrCreateChunk(cx, cz) {
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz, this);
      this.chunks.set(key, chunk);
      this.generateChunkTerrain(chunk);
    }
    return chunk;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0;
    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    return chunk.getBlock(lx, y, lz);
  }

  setBlock(x, y, z, id, save = true, remesh = true) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const chunk = this.getOrCreateChunk(cx, cz);
    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    chunk.setBlock(lx, y, lz, id);

    if (save) {
      this.saveDelta(x, y, z, id);
    }

    // Border chunk notifications
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE_X - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.markChunkDirty(cx, cz + 1);

    if (remesh) {
      this.updateChunkMesh(chunk);
    }
  }

  markChunkDirty(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c) c.isDirty = true;
  }

  generateChunkTerrain(chunk) {
    if (chunk.generated) return;
    const cx = chunk.cx;
    const cz = chunk.cz;
    const startX = cx * CHUNK_SIZE_X;
    const startZ = cz * CHUNK_SIZE_Z;

    // First pass: Terrain elevation & biomes
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const wx = startX + lx;
        const wz = startZ + lz;

        // Smooth elevation heightmap
        const n1 = this.noise.noise2D(wx * 0.02, wz * 0.02);
        const n2 = this.noise.noise2D(wx * 0.06, wz * 0.06) * 0.5;
        const n3 = this.noise.noise2D(wx * 0.12, wz * 0.12) * 0.25;
        const rawHeight = 16 + (n1 + n2 + n3) * 10;
        const h = Math.max(3, Math.min(CHUNK_HEIGHT - 8, Math.floor(rawHeight)));

        // Bedrock at y = 0
        chunk.setBlock(lx, 0, lz, 12); // Bedrock

        // Stone & Ores
        for (let y = 1; y < h - 3; y++) {
          let block = 3; // Stone
          const oreR = this.noise.noise2D((wx + 50) * 0.15, (y + wz) * 0.15);
          if (y < 8 && oreR > 0.72) block = 16; // Diamond Ore
          else if (y < 14 && oreR > 0.65) block = 17; // Redstone Ore
          else if (y < 18 && oreR > 0.60) block = 15; // Gold Ore
          else if (y < 24 && oreR > 0.52) block = 14; // Iron Ore
          else if (oreR > 0.45) block = 13; // Coal Ore
          chunk.setBlock(lx, y, lz, block);
        }

        // Subsurface Dirt
        for (let y = Math.max(1, h - 3); y < h; y++) {
          chunk.setBlock(lx, y, lz, (h <= SEA_LEVEL + 1) ? 9 : 2); // Sand near water, Dirt elsewhere
        }

        // Surface Block
        if (h <= SEA_LEVEL + 1) {
          chunk.setBlock(lx, h, lz, 9); // Sand
        } else if (h > 26) {
          chunk.setBlock(lx, h, lz, 23); // Snow Grass
        } else {
          chunk.setBlock(lx, h, lz, 1); // Grass Block
        }

        // Water filling
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            chunk.setBlock(lx, y, lz, 11); // Water
          }
        }
      }
    }

    // Second pass: Trees & Foliage
    for (let lx = 2; lx < CHUNK_SIZE_X - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE_Z - 2; lz++) {
        const wx = startX + lx;
        const wz = startZ + lz;
        const treeNoise = Math.sin(wx * 9.2 + wz * 13.7);
        if (treeNoise > 0.88) {
          // Find surface height
          let surfaceY = -1;
          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            const b = chunk.getBlock(lx, y, lz);
            if (b === 1) { // Only grow on Grass
              surfaceY = y;
              break;
            }
          }

          if (surfaceY > SEA_LEVEL && surfaceY < CHUNK_HEIGHT - 8) {
            this.buildTree(chunk, lx, surfaceY + 1, lz);
          }
        }
      }
    }

    // Apply saved deltas for this chunk
    for (const key in this.savedDeltas) {
      const [dx, dy, dz] = key.split(',').map(Number);
      if (Math.floor(dx / CHUNK_SIZE_X) === cx && Math.floor(dz / CHUNK_SIZE_Z) === cz) {
        const lx = ((dx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
        const lz = ((dz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
        chunk.setBlock(lx, dy, lz, this.savedDeltas[key]);
      }
    }

    chunk.generated = true;
  }

  buildTree(chunk, lx, startY, lz) {
    const trunkHeight = 4;
    // Wood Trunk
    for (let dy = 0; dy < trunkHeight; dy++) {
      chunk.setBlock(lx, startY + dy, lz, 5); // Oak Wood
    }
    // Leaves Canopy
    const leavesY = startY + trunkHeight - 2;
    // 5x5 Layer
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // Cut corners
        if (dx === 0 && dz === 0) continue; // Keep trunk
        chunk.setBlock(lx + dx, leavesY, lz + dz, 6);
        chunk.setBlock(lx + dx, leavesY + 1, lz + dz, 6);
      }
    }
    // 3x3 Layer
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        chunk.setBlock(lx + dx, leavesY + 2, lz + dz, 6);
      }
    }
    // Crown cross
    chunk.setBlock(lx, leavesY + 3, lz, 6);
    chunk.setBlock(lx + 1, leavesY + 3, lz, 6);
    chunk.setBlock(lx - 1, leavesY + 3, lz, 6);
    chunk.setBlock(lx, leavesY + 3, lz + 1, 6);
    chunk.setBlock(lx, leavesY + 3, lz - 1, 6);
  }

  generateWorld() {
    const rd = this.renderDistance;
    for (let cx = -rd; cx <= rd; cx++) {
      for (let cz = -rd; cz <= rd; cz++) {
        this.getOrCreateChunk(cx, cz);
      }
    }
    // Build meshes
    for (const chunk of this.chunks.values()) {
      this.updateChunkMesh(chunk);
    }
  }

  // Calculate Ambient Occlusion (0 to 3) for a vertex
  calculateAO(side1, side2, corner) {
    if (side1 && side2) return 0;
    return 3 - (side1 + side2 + corner);
  }

  getAOIntensity(ao) {
    // Return RGB multiplier
    if (ao === 3) return 1.0;
    if (ao === 2) return 0.82;
    if (ao === 1) return 0.65;
    return 0.45;
  }

  // Efficient Greedy / Face-Culling Mesher
  updateChunkMesh(chunk) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const worldX0 = cx * CHUNK_SIZE_X;
    const worldZ0 = cz * CHUNK_SIZE_Z;

    const opaquePositions = [];
    const opaqueNormals = [];
    const opaqueUvs = [];
    const opaqueColors = [];

    const transPositions = [];
    const transNormals = [];
    const transUvs = [];
    const transColors = [];

    // Direction vectors: [dx, dy, dz, normal, faceName, tileProp]
    const FACES = [
      { dir: [1, 0, 0], norm: [1, 0, 0], name: 'posX', uvs: [0, 1, 2, 3], side: 'side' },
      { dir: [-1, 0, 0], norm: [-1, 0, 0], name: 'negX', uvs: [0, 1, 2, 3], side: 'side' },
      { dir: [0, 1, 0], norm: [0, 1, 0], name: 'posY', uvs: [0, 1, 2, 3], side: 'top' },
      { dir: [0, -1, 0], norm: [0, -1, 0], name: 'negY', uvs: [0, 1, 2, 3], side: 'bottom' },
      { dir: [0, 0, 1], norm: [0, 0, 1], name: 'posZ', uvs: [0, 1, 2, 3], side: 'side' },
      { dir: [0, 0, -1], norm: [0, 0, -1], name: 'negZ', uvs: [0, 1, 2, 3], side: 'side' }
    ];

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        for (let x = 0; x < CHUNK_SIZE_X; x++) {
          const blockId = chunk.getBlock(x, y, z);
          if (blockId === 0) continue; // Air

          const def = BLOCK_DEFS[blockId];
          if (!def) continue;

          const wx = worldX0 + x;
          const wz = worldZ0 + z;
          const isTrans = def.transparent || def.isLiquid;

          for (const face of FACES) {
            const [fdx, fdy, fdz] = face.dir;
            const nx = wx + fdx;
            const ny = y + fdy;
            const nz = wz + fdz;

            const neighborId = this.getBlock(nx, ny, nz);
            const nDef = BLOCK_DEFS[neighborId] || BLOCK_DEFS[0];

            // Face culling condition:
            // Only draw face if neighbor is air OR neighbor is transparent (and not identical transparent block)
            let drawFace = false;
            if (neighborId === 0) {
              drawFace = true;
            } else if (nDef.transparent || nDef.isLiquid) {
              if (isTrans && neighborId === blockId) {
                drawFace = false; // Don't draw internal water/glass faces
              } else {
                drawFace = true;
              }
            }

            if (!drawFace) continue;

            // Determine tile index for this face
            let tileIdx = def.all;
            if (tileIdx === undefined) {
              if (face.side === 'top') tileIdx = def.top;
              else if (face.side === 'bottom') tileIdx = def.bottom;
              else tileIdx = def.side;
            }
            if (tileIdx === undefined) tileIdx = 0;

            const uv = this.textureGen.getUVs(tileIdx);

            // Quad vertex positions
            let quadVertices = [];
            if (face.name === 'posY') { // Top
              quadVertices = [
                [wx, y + 1, wz + 1],
                [wx + 1, y + 1, wz + 1],
                [wx + 1, y + 1, wz],
                [wx, y + 1, wz]
              ];
            } else if (face.name === 'negY') { // Bottom
              quadVertices = [
                [wx, y, wz],
                [wx + 1, y, wz],
                [wx + 1, y, wz + 1],
                [wx, y, wz + 1]
              ];
            } else if (face.name === 'posX') { // Right (+X)
              quadVertices = [
                [wx + 1, y, wz + 1],
                [wx + 1, y, wz],
                [wx + 1, y + 1, wz],
                [wx + 1, y + 1, wz + 1]
              ];
            } else if (face.name === 'negX') { // Left (-X)
              quadVertices = [
                [wx, y, wz],
                [wx, y, wz + 1],
                [wx, y + 1, wz + 1],
                [wx, y + 1, wz]
              ];
            } else if (face.name === 'posZ') { // Front (+Z)
              quadVertices = [
                [wx, y, wz + 1],
                [wx + 1, y, wz + 1],
                [wx + 1, y + 1, wz + 1],
                [wx, y + 1, wz + 1]
              ];
            } else if (face.name === 'negZ') { // Back (-Z)
              quadVertices = [
                [wx + 1, y, wz],
                [wx, y, wz],
                [wx, y + 1, wz],
                [wx + 1, y + 1, wz]
              ];
            }

            // Directional Light Shading
            let lightMult = 1.0;
            if (face.name === 'posY') lightMult = 1.0;
            else if (face.name === 'negY') lightMult = 0.5;
            else if (face.name === 'posZ' || face.name === 'negZ') lightMult = 0.8;
            else lightMult = 0.65;

            // Target arrays
            const posArr = isTrans ? transPositions : opaquePositions;
            const normArr = isTrans ? transNormals : opaqueNormals;
            const uvArr = isTrans ? transUvs : opaqueUvs;
            const colArr = isTrans ? transColors : opaqueColors;

            // Two Triangles for quad: (0, 1, 2) and (0, 2, 3)
            const indices = [0, 1, 2, 0, 2, 3];
            const quadUVs = [
              [uv.u0, uv.v0],
              [uv.u1, uv.v0],
              [uv.u1, uv.v1],
              [uv.u0, uv.v1]
            ];

            for (const idx of indices) {
              const v = quadVertices[idx];
              posArr.push(v[0], v[1], v[2]);
              normArr.push(face.norm[0], face.norm[1], face.norm[2]);
              const u = quadUVs[idx];
              uvArr.push(u[0], u[1]);
              colArr.push(lightMult, lightMult, lightMult);
            }
          }
        }
      }
    }

    // Build or update Opaque Mesh
    if (chunk.opaqueMesh) {
      this.scene.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (opaquePositions.length > 0) {
      const geo = new this.THREE.BufferGeometry();
      geo.setAttribute('position', new this.THREE.Float32BufferAttribute(opaquePositions, 3));
      geo.setAttribute('normal', new this.THREE.Float32BufferAttribute(opaqueNormals, 3));
      geo.setAttribute('uv', new this.THREE.Float32BufferAttribute(opaqueUvs, 2));
      geo.setAttribute('color', new this.THREE.Float32BufferAttribute(opaqueColors, 3));
      chunk.opaqueMesh = new this.THREE.Mesh(geo, this.opaqueMaterial);
      this.scene.add(chunk.opaqueMesh);
    }

    // Build or update Transparent Mesh
    if (chunk.transparentMesh) {
      this.scene.remove(chunk.transparentMesh);
      chunk.transparentMesh.geometry.dispose();
      chunk.transparentMesh = null;
    }
    if (transPositions.length > 0) {
      const geo = new this.THREE.BufferGeometry();
      geo.setAttribute('position', new this.THREE.Float32BufferAttribute(transPositions, 3));
      geo.setAttribute('normal', new this.THREE.Float32BufferAttribute(transNormals, 3));
      geo.setAttribute('uv', new this.THREE.Float32BufferAttribute(transUvs, 2));
      geo.setAttribute('color', new this.THREE.Float32BufferAttribute(transColors, 3));
      chunk.transparentMesh = new this.THREE.Mesh(geo, this.transparentMaterial);
      this.scene.add(chunk.transparentMesh);
    }

    chunk.isDirty = false;
  }
}
