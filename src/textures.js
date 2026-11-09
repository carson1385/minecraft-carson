// Textures & Procedural Texture Atlas Generator for Minecraft Web
// Generates authentic 16x16 pixel-art Minecraft textures on a 256x256 canvas

export const BLOCK_DEFS = {
  0:  { name: 'Air', solid: false, transparent: true, icon: null },
  1:  { name: 'Grass Block', solid: true, transparent: false, top: 1, bottom: 0, side: 2 },
  2:  { name: 'Dirt', solid: true, transparent: false, all: 0 },
  3:  { name: 'Stone', solid: true, transparent: false, all: 3 },
  4:  { name: 'Cobblestone', solid: true, transparent: false, all: 4 },
  5:  { name: 'Oak Wood', solid: true, transparent: false, top: 6, bottom: 6, side: 5 },
  6:  { name: 'Oak Leaves', solid: true, transparent: true, all: 7 },
  7:  { name: 'Oak Planks', solid: true, transparent: false, all: 8 },
  8:  { name: 'Bricks', solid: true, transparent: false, all: 9 },
  9:  { name: 'Sand', solid: true, transparent: false, all: 10 },
  10: { name: 'Glass', solid: true, transparent: true, all: 11 },
  11: { name: 'Water', solid: false, transparent: true, isLiquid: true, all: 12 },
  12: { name: 'Bedrock', solid: true, transparent: false, all: 13 },
  13: { name: 'Coal Ore', solid: true, transparent: false, all: 14 },
  14: { name: 'Iron Ore', solid: true, transparent: false, all: 15 },
  15: { name: 'Gold Ore', solid: true, transparent: false, all: 16 },
  16: { name: 'Diamond Ore', solid: true, transparent: false, all: 17 },
  17: { name: 'Redstone Ore', solid: true, transparent: false, all: 18 },
  18: { name: 'Bookshelf', solid: true, transparent: false, top: 8, bottom: 8, side: 19 },
  19: { name: 'TNT', solid: true, transparent: false, top: 21, bottom: 22, side: 20 },
  20: { name: 'Crafting Table', solid: true, transparent: false, top: 23, bottom: 8, side: 24 },
  21: { name: 'Glowstone', solid: true, transparent: false, all: 25 },
  22: { name: 'Obsidian', solid: true, transparent: false, all: 26 },
  23: { name: 'Snow Grass', solid: true, transparent: false, top: 27, bottom: 0, side: 28 },
  24: { name: 'Cactus', solid: true, transparent: false, top: 30, bottom: 30, side: 29 }
};

export class TextureGenerator {
  constructor() {
    this.atlasSize = 256;
    this.tileSize = 16;
    this.tilesPerRow = this.atlasSize / this.tileSize; // 16 tiles
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.atlasSize;
    this.canvas.height = this.atlasSize;
    this.ctx = this.canvas.getContext('2d');
    this.tileCanvases = {};
    this.generateAtlas();
  }

  // PRNG for consistent pixel texture noise
  noise(x, y, seed = 0) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
    return n - Math.floor(n);
  }

  drawTile(tileIndex, drawFunc) {
    const tx = (tileIndex % this.tilesPerRow) * this.tileSize;
    const ty = Math.floor(tileIndex / this.tilesPerRow) * this.tileSize;
    
    // Create dedicated 16x16 canvas for icon preview
    const tCanvas = document.createElement('canvas');
    tCanvas.width = 16;
    tCanvas.height = 16;
    const tCtx = tCanvas.getContext('2d');
    
    // Draw on tile canvas
    drawFunc(tCtx, 0, 0);
    this.tileCanvases[tileIndex] = tCanvas;

    // Draw onto atlas canvas
    this.ctx.drawImage(tCanvas, tx, ty);
  }

  generateAtlas() {
    const s = this.tileSize;

    // 0: Dirt (Rich warm loam)
    this.drawTile(0, (ctx) => {
      ctx.fillStyle = '#8c5a36';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 1);
          if (r < 0.25) {
            ctx.fillStyle = '#6d4224';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.75) {
            ctx.fillStyle = '#a67046';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 1: Grass Top (Vibrant lush sunny lime-emerald green)
    this.drawTile(1, (ctx) => {
      ctx.fillStyle = '#4ec92b';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 2);
          if (r < 0.22) {
            ctx.fillStyle = '#3aa81d';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.78) {
            ctx.fillStyle = '#6ce83a';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 2: Grass Side (Dirt bottom with vibrant dripping grass fringe)
    this.drawTile(2, (ctx) => {
      // Dirt base
      ctx.fillStyle = '#8c5a36';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 1);
          if (r < 0.25) {
            ctx.fillStyle = '#6d4224';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.75) {
            ctx.fillStyle = '#a67046';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      // Top grass layer
      ctx.fillStyle = '#4ec92b';
      ctx.fillRect(0, 0, s, 3);
      // Drips
      for (let x = 0; x < s; x++) {
        const drip = Math.floor(this.noise(x, 0, 3) * 3);
        ctx.fillStyle = '#4ec92b';
        ctx.fillRect(x, 2, 1, drip + 1);
        if (this.noise(x, 1, 4) > 0.5) {
          ctx.fillStyle = '#6ce83a';
          ctx.fillRect(x, 0, 1, 2);
        }
      }
    });

    // 3: Stone (Crisp, clean textured stone)
    this.drawTile(3, (ctx) => {
      ctx.fillStyle = '#828894';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 5);
          if (r < 0.22) {
            ctx.fillStyle = '#636873';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.78) {
            ctx.fillStyle = '#9da4b2';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 4: Cobblestone (Sharp contrasting stones)
    this.drawTile(4, (ctx) => {
      ctx.fillStyle = '#474d57';
      ctx.fillRect(0, 0, s, s);
      const stones = [
        [0, 0, 8, 4], [8, 0, 8, 5],
        [0, 4, 5, 5], [5, 5, 6, 4], [11, 5, 5, 5],
        [0, 9, 8, 4], [8, 10, 8, 6],
        [0, 13, 8, 3]
      ];
      stones.forEach(([x, y, w, h], idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#7d8491' : '#6a717e';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(x + 1, y + 1, w - 2, 1);
      });
    });

    // 5: Oak Wood Side (Warm rich oak bark)
    this.drawTile(5, (ctx) => {
      ctx.fillStyle = '#7d5329';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        const line = this.noise(x, 0, 6) > 0.4 ? '#5e3c1a' : '#946637';
        ctx.fillStyle = line;
        ctx.fillRect(x, 0, 1, s);
      }
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          if (this.noise(x, y, 7) > 0.7) {
            ctx.fillStyle = '#472c10';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 6: Oak Wood Top (Golden rings)
    this.drawTile(6, (ctx) => {
      ctx.fillStyle = '#c79f5e';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#7d5329';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Ring
      ctx.fillStyle = '#9e7940';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#c79f5e';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = '#7d5329';
      ctx.fillRect(7, 7, 2, 2);
    });

    // 7: Oak Leaves (Lush vibrant green with sunlit dapples)
    this.drawTile(7, (ctx) => {
      ctx.fillStyle = '#2ebd17';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 8);
          if (r < 0.25) {
            ctx.fillStyle = '#1e8a0c';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.75) {
            ctx.fillStyle = '#54e637';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 8: Oak Planks (Golden honey planks)
    this.drawTile(8, (ctx) => {
      ctx.fillStyle = '#d49b4b';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 4; i++) {
        const y = i * 4;
        ctx.fillStyle = '#8f6127';
        ctx.fillRect(0, y, s, 1);
        ctx.fillStyle = '#f0b869';
        ctx.fillRect(0, y + 1, s, 1);
        const splitX = (i % 2 === 0) ? 8 : 4;
        ctx.fillStyle = '#8f6127';
        ctx.fillRect(splitX, y, 1, 4);
      }
    });

    // 9: Bricks (Vibrant terracotta)
    this.drawTile(9, (ctx) => {
      ctx.fillStyle = '#f0ede8'; // Mortar
      ctx.fillRect(0, 0, s, s);
      const bColor = '#c23c27';
      const bLight = '#db4d37';
      for (let r = 0; r < 4; r++) {
        const y = r * 4;
        const offset = (r % 2 === 1) ? 4 : 0;
        for (let c = 0; c < 3; c++) {
          const x = (c * 8 + offset) % 16;
          ctx.fillStyle = bColor;
          ctx.fillRect(x + 1, y + 1, 6, 2);
          ctx.fillStyle = bLight;
          ctx.fillRect(x + 1, y + 1, 6, 1);
        }
      }
    });

    // 10: Sand (Warm sunny gold Caribbean sand)
    this.drawTile(10, (ctx) => {
      ctx.fillStyle = '#f5df82';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 10);
          if (r < 0.2) {
            ctx.fillStyle = '#dbc060';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.8) {
            ctx.fillStyle = '#fff1a8';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 11: Glass
    this.drawTile(11, (ctx) => {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(235, 250, 255, 0.85)';
      ctx.fillRect(0, 0, s, 1);
      ctx.fillRect(0, s - 1, s, 1);
      ctx.fillRect(0, 0, 1, s);
      ctx.fillRect(s - 1, 0, 1, s);
      // Bright diagonal gleam
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(9, 11, 2, 2);
      ctx.fillRect(11, 13, 2, 2);
      ctx.fillStyle = 'rgba(210, 240, 255, 0.2)';
      ctx.fillRect(1, 1, 14, 14);
    });

    // 12: Water (Vibrant tropical azure aqua blue)
    this.drawTile(12, (ctx) => {
      ctx.fillStyle = 'rgba(28, 140, 245, 0.78)';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          if (this.noise(x, y, 12) > 0.6) {
            ctx.fillStyle = 'rgba(80, 190, 255, 0.85)';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 13: Bedrock
    this.drawTile(13, (ctx) => {
      ctx.fillStyle = '#222222';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 13);
          if (r < 0.25) {
            ctx.fillStyle = '#0f0f0f';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.7) {
            ctx.fillStyle = '#444444';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // Helper for Ores on Stone Base
    const drawOre = (tileIdx, oreColor, oreLight, seed) => {
      this.drawTile(tileIdx, (ctx) => {
        // Base stone
        ctx.fillStyle = '#7a7a7a';
        ctx.fillRect(0, 0, s, s);
        for (let x = 0; x < s; x++) {
          for (let y = 0; y < s; y++) {
            const r = this.noise(x, y, 5);
            if (r < 0.2) {
              ctx.fillStyle = '#636363';
              ctx.fillRect(x, y, 1, 1);
            } else if (r > 0.8) {
              ctx.fillStyle = '#8f8f8f';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        // Ore specks
        for (let x = 1; x < s - 1; x++) {
          for (let y = 1; y < s - 1; y++) {
            if (this.noise(x, y, seed) > 0.76) {
              ctx.fillStyle = oreColor;
              ctx.fillRect(x, y, 2, 2);
              ctx.fillStyle = oreLight;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      });
    };

    // 14: Coal Ore
    drawOre(14, '#1e1e1e', '#3a3a3a', 14);

    // 15: Iron Ore
    drawOre(15, '#c89d7c', '#e2c5ae', 15);

    // 16: Gold Ore
    drawOre(16, '#f3c737', '#fdf399', 16);

    // 17: Diamond Ore
    drawOre(17, '#42d8d8', '#a8ffff', 17);

    // 18: Redstone Ore
    drawOre(18, '#cc1212', '#ff5555', 18);

    // 19: Bookshelf Side
    this.drawTile(19, (ctx) => {
      // Planks frame
      ctx.fillStyle = '#ab8b53';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#4d3921';
      ctx.fillRect(1, 1, 14, 6);
      ctx.fillRect(1, 9, 14, 6);
      // Shelf books
      const bookColors = ['#9c2727', '#2e5b88', '#2e7a3e', '#ab7b26', '#693685'];
      for (let shelf = 0; shelf < 2; shelf++) {
        const sy = shelf === 0 ? 2 : 10;
        let bx = 2;
        while (bx < 14) {
          const bw = Math.min(2 + Math.floor(this.noise(bx, sy, 19) * 2), 14 - bx);
          const col = bookColors[Math.floor(this.noise(bx, sy + shelf, 20) * bookColors.length)];
          ctx.fillStyle = col;
          ctx.fillRect(bx, sy, bw, 5);
          ctx.fillStyle = '#dcdcdc'; // Pages top
          ctx.fillRect(bx, sy, bw, 1);
          bx += bw + 1;
        }
      }
    });

    // 20: TNT Side
    this.drawTile(20, (ctx) => {
      ctx.fillStyle = '#ba2b20';
      ctx.fillRect(0, 0, s, s);
      // Sticks vertical ridges
      for (let x = 0; x < s; x += 3) {
        ctx.fillStyle = '#8f1a11';
        ctx.fillRect(x, 0, 1, s);
      }
      // White banner
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 6, s, 4);
      // TNT Text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 4px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TNT', 8, 8.5);
    });

    // 21: TNT Top
    this.drawTile(21, (ctx) => {
      ctx.fillStyle = '#ba2b20';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#222222';
      ctx.fillRect(7, 7, 2, 2); // Center fuse
    });

    // 22: TNT Bottom
    this.drawTile(22, (ctx) => {
      ctx.fillStyle = '#ba2b20';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(4, 4, 8, 8);
    });

    // 23: Crafting Table Top
    this.drawTile(23, (ctx) => {
      ctx.fillStyle = '#b18c4c';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#614822';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // 3x3 Grid
      for (let i = 1; i <= 2; i++) {
        ctx.fillRect(i * 5, 1, 1, 14);
        ctx.fillRect(1, i * 5, 14, 1);
      }
    });

    // 24: Crafting Table Side
    this.drawTile(24, (ctx) => {
      ctx.fillStyle = '#ab8b53';
      ctx.fillRect(0, 0, s, s);
      // Saw & hammer tool silhouettes
      ctx.fillStyle = '#614822';
      ctx.fillRect(1, 1, 14, 2);
      ctx.fillRect(3, 5, 4, 8);
      ctx.fillRect(9, 6, 4, 2);
      ctx.fillRect(10, 8, 2, 6);
    });

    // 25: Glowstone
    this.drawTile(25, (ctx) => {
      ctx.fillStyle = '#c79d46';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 25);
          if (r < 0.3) {
            ctx.fillStyle = '#9b712b';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.7) {
            ctx.fillStyle = '#fae178';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 26: Obsidian
    this.drawTile(26, (ctx) => {
      ctx.fillStyle = '#161124';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          const r = this.noise(x, y, 26);
          if (r < 0.25) {
            ctx.fillStyle = '#0e0b17';
            ctx.fillRect(x, y, 1, 1);
          } else if (r > 0.75) {
            ctx.fillStyle = '#2f2048';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 27: Snow Top
    this.drawTile(27, (ctx) => {
      ctx.fillStyle = '#f5f7fa';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          if (this.noise(x, y, 27) > 0.8) {
            ctx.fillStyle = '#e4eaf2';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    // 28: Snow Side
    this.drawTile(28, (ctx) => {
      // Dirt base
      ctx.fillStyle = '#866043';
      ctx.fillRect(0, 0, s, s);
      // Snow cap
      ctx.fillStyle = '#f5f7fa';
      ctx.fillRect(0, 0, s, 4);
      for (let x = 0; x < s; x++) {
        const drip = Math.floor(this.noise(x, 0, 28) * 3);
        ctx.fillRect(x, 3, 1, drip + 1);
      }
    });

    // 29: Cactus Side
    this.drawTile(29, (ctx) => {
      ctx.fillStyle = '#4c7828';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 3) {
        ctx.fillStyle = '#3a5f1e';
        ctx.fillRect(x, 0, 1, s);
      }
      for (let x = 1; x < s; x += 3) {
        for (let y = 1; y < s; y += 4) {
          ctx.fillStyle = '#1c340b';
          ctx.fillRect(x, y, 1, 1); // Spine
        }
      }
    });

    // 30: Cactus Top
    this.drawTile(30, (ctx) => {
      ctx.fillStyle = '#4c7828';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#3a5f1e';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillRect(7, 7, 2, 2);
    });
  }

  // Get UV coordinates for a tile index
  getUVs(tileIdx) {
    const tx = tileIdx % this.tilesPerRow;
    const ty = Math.floor(tileIdx / this.tilesPerRow);
    const u0 = tx / this.tilesPerRow;
    const u1 = (tx + 1) / this.tilesPerRow;
    const v1 = 1.0 - (ty / this.tilesPerRow);
    const v0 = 1.0 - ((ty + 1) / this.tilesPerRow);
    return { u0, v0, u1, v1 };
  }

  // Get Three.js texture
  createThreeTexture(THREE) {
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }
}

