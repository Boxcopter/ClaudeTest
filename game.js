// Return Fire - Web Edition
// Main Game Engine

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1200;
        this.canvas.height = 800;

        // Game state
        this.keys = {};
        this.buildings = [];
        this.projectiles = [];
        this.particles = [];
        this.palmTrees = [];
        this.destroyedCount = 0;
        this.flagRevealed = false;
        this.flagCaptured = false;
        this.gameWon = false;
        this.gameStarted = false;
        this.selectedVehicle = null;

        // Isometric settings
        this.tileWidth = 64;
        this.tileHeight = 32;
        this.mapWidth = 40;
        this.mapHeight = 40;

        // Camera
        this.camera = {
            x: 0,
            y: 0
        };

        // Vehicle definitions
        this.vehicleTypes = {
            tank: {
                name: 'Tank',
                speed: 0.08,
                maxSpeed: 0.15,
                fireRate: 30,
                projectileSpeed: 0.4,
                damage: 2,
                size: 1.0,
                canFly: false
            },
            hummer: {
                name: 'Hummer',
                speed: 0.15,
                maxSpeed: 0.3,
                fireRate: 15,
                projectileSpeed: 0.6,
                damage: 1,
                size: 0.8,
                canFly: false
            },
            helicopter: {
                name: 'Helicopter',
                speed: 0.12,
                maxSpeed: 0.25,
                fireRate: 10,
                projectileSpeed: 0.5,
                damage: 1,
                size: 1.2,
                canFly: true,
                altitude: 0
            }
        };

        // Initialize
        this.initMap();
        this.initBuildings();
        this.initPalmTrees();
        this.initEventListeners();
        this.lastTime = 0;

        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    initMap() {
        // Create tile map with 3D islands
        this.map = [];
        for (let y = 0; y < this.mapHeight; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                // Create islands with noise-like pattern
                const centerX = this.mapWidth / 2;
                const centerY = this.mapHeight / 2;
                const distFromCenter = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                );

                // Create multiple island clusters
                const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3);
                const isLand = distFromCenter < 12 + noise * 3 ||
                              (Math.abs(x - 10) < 5 && Math.abs(y - 10) < 5) ||
                              (Math.abs(x - 30) < 5 && Math.abs(y - 30) < 5) ||
                              (Math.abs(x - 30) < 5 && Math.abs(y - 10) < 5) ||
                              (Math.abs(x - 10) < 5 && Math.abs(y - 30) < 5);

                // Calculate terrain height for 3D effect
                let height = 0;
                let type = 'water';

                if (isLand) {
                    // Calculate distance to nearest water for sand detection
                    let nearWater = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
                                const nCenterX = this.mapWidth / 2;
                                const nCenterY = this.mapHeight / 2;
                                const nDistFromCenter = Math.sqrt(
                                    Math.pow(nx - nCenterX, 2) + Math.pow(ny - nCenterY, 2)
                                );
                                const nNoise = Math.sin(nx * 0.3) * Math.cos(ny * 0.3);
                                const nIsLand = nDistFromCenter < 12 + nNoise * 3 ||
                                              (Math.abs(nx - 10) < 5 && Math.abs(ny - 10) < 5) ||
                                              (Math.abs(nx - 30) < 5 && Math.abs(ny - 30) < 5) ||
                                              (Math.abs(nx - 30) < 5 && Math.abs(ny - 10) < 5) ||
                                              (Math.abs(nx - 10) < 5 && Math.abs(ny - 30) < 5);
                                if (!nIsLand) nearWater = true;
                            }
                        }
                    }

                    if (nearWater) {
                        type = 'sand';
                        height = 0.2;
                    } else {
                        type = 'grass';
                        // Height increases toward center of island
                        const localNoise = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.3;
                        height = 0.5 + localNoise;
                    }
                }

                this.map[y][x] = {
                    type: type,
                    height: height,
                    x: x,
                    y: y
                };
            }
        }
    }

    initPlayer(vehicleType) {
        const vehicle = this.vehicleTypes[vehicleType];
        this.selectedVehicle = vehicleType;

        this.player = {
            x: this.mapWidth / 2,
            y: this.mapHeight / 2,
            vx: 0,
            vy: 0,
            angle: 0,
            speed: vehicle.speed,
            maxSpeed: vehicle.maxSpeed,
            friction: 0.95,
            size: vehicle.size,
            hasFlag: false,
            vehicleType: vehicleType,
            canFly: vehicle.canFly,
            altitude: 0,
            targetAltitude: 0,
            weapon: {
                cooldown: 0,
                maxCooldown: vehicle.fireRate,
                damage: vehicle.damage,
                projectileSpeed: vehicle.projectileSpeed
            }
        };
    }

    initPalmTrees() {
        // Add palm trees on islands
        for (let i = 0; i < 60; i++) {
            let x, y;
            let attempts = 0;

            // Find a valid position on land
            do {
                x = Math.floor(Math.random() * this.mapWidth);
                y = Math.floor(Math.random() * this.mapHeight);
                attempts++;
            } while ((!this.isOnLand(x, y) || this.map[y][x].type === 'sand') && attempts < 100);

            if (attempts < 100) {
                this.palmTrees.push({
                    x: x + Math.random() * 0.6 - 0.3,
                    y: y + Math.random() * 0.6 - 0.3,
                    height: 2 + Math.random() * 1,
                    destroyed: false,
                    burning: false,
                    burnTime: 0,
                    leanAngle: 0,
                    leanDirection: 0
                });
            }
        }
    }

    initBuildings() {
        // Create military bases on different islands
        const bases = [
            { centerX: 10, centerY: 10, count: 3 },
            { centerX: 30, centerY: 10, count: 3 },
            { centerX: 10, centerY: 30, count: 3 },
            { centerX: 30, centerY: 30, count: 4 } // This one has the flag
        ];

        bases.forEach((base, baseIndex) => {
            for (let i = 0; i < base.count; i++) {
                const angle = (i / base.count) * Math.PI * 2;
                const radius = 2 + Math.random() * 2;
                const x = base.centerX + Math.cos(angle) * radius;
                const y = base.centerY + Math.sin(angle) * radius;

                const building = {
                    x: x,
                    y: y,
                    width: 1.5,
                    height: 1.5,
                    hp: 3,
                    maxHp: 3,
                    destroyed: false,
                    hasFlag: baseIndex === 3 && i === 0, // Flag in first building of last base
                    type: Math.random() > 0.5 ? 'bunker' : 'tower'
                };

                this.buildings.push(building);
            }
        });

        // Player's home base
        this.homeBase = {
            x: this.mapWidth / 2,
            y: this.mapHeight / 2,
            radius: 2
        };
    }

    initEventListeners() {
        // Handle vehicle selection
        this.canvas.addEventListener('click', (e) => {
            if (!this.gameStarted) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Check which vehicle was clicked
                const centerY = this.canvas.height / 2;
                const spacing = 300;
                const vehiclePositions = {
                    tank: this.canvas.width / 2 - spacing,
                    hummer: this.canvas.width / 2,
                    helicopter: this.canvas.width / 2 + spacing
                };

                for (let [type, posX] of Object.entries(vehiclePositions)) {
                    const dist = Math.sqrt(Math.pow(x - posX, 2) + Math.pow(y - centerY, 2));
                    if (dist < 80) {
                        this.initPlayer(type);
                        this.gameStarted = true;
                        break;
                    }
                }
            }
        });

        window.addEventListener('keydown', (e) => {
            if (!this.gameStarted) return;

            this.keys[e.key.toLowerCase()] = true;

            // Fire weapon
            if (e.key === ' ') {
                e.preventDefault();
                this.fireWeapon();
            }

            // Interact with buildings
            if (e.key.toLowerCase() === 'e') {
                this.interact();
            }

            // Helicopter altitude control
            if (this.player && this.player.canFly) {
                if (e.key.toLowerCase() === 'q') {
                    this.player.targetAltitude = Math.max(0, this.player.targetAltitude - 1);
                }
                if (e.key.toLowerCase() === 'z') {
                    this.player.targetAltitude = Math.min(3, this.player.targetAltitude + 1);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    interact() {
        // Check for nearby destroyed buildings with flag
        for (let building of this.buildings) {
            if (building.destroyed && building.hasFlag && !this.flagCaptured) {
                const dist = Math.sqrt(
                    Math.pow(this.player.x - building.x, 2) +
                    Math.pow(this.player.y - building.y, 2)
                );

                if (dist < 2) {
                    this.player.hasFlag = true;
                    this.flagCaptured = true;
                    this.updateUI();
                    this.createParticles(building.x, building.y, '#ff0', 20);
                    return;
                }
            }
        }

        // Check if at home base with flag
        if (this.player.hasFlag) {
            const dist = Math.sqrt(
                Math.pow(this.player.x - this.homeBase.x, 2) +
                Math.pow(this.player.y - this.homeBase.y, 2)
            );

            if (dist < this.homeBase.radius) {
                this.gameWon = true;
                this.updateUI();
            }
        }
    }

    fireWeapon() {
        if (this.player.weapon.cooldown > 0) return;

        this.player.weapon.cooldown = this.player.weapon.maxCooldown;

        // Create projectile
        const projectile = {
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(this.player.angle) * this.player.weapon.projectileSpeed,
            vy: Math.sin(this.player.angle) * this.player.weapon.projectileSpeed,
            life: 60,
            damage: this.player.weapon.damage
        };

        this.projectiles.push(projectile);
    }

    update(deltaTime) {
        // Update weapon cooldown
        if (this.player.weapon.cooldown > 0) {
            this.player.weapon.cooldown--;
        }

        // Update helicopter altitude
        if (this.player.canFly) {
            if (this.player.altitude < this.player.targetAltitude) {
                this.player.altitude += 0.05;
            } else if (this.player.altitude > this.player.targetAltitude) {
                this.player.altitude -= 0.05;
            }
        }

        // Player movement
        let moveX = 0;
        let moveY = 0;

        if (this.keys['w'] || this.keys['arrowup']) moveY -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveY += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

        // Calculate angle based on movement
        if (moveX !== 0 || moveY !== 0) {
            this.player.angle = Math.atan2(moveY, moveX);
            this.player.vx += Math.cos(this.player.angle) * this.player.speed;
            this.player.vy += Math.sin(this.player.angle) * this.player.speed;
        }

        // Apply friction
        this.player.vx *= this.player.friction;
        this.player.vy *= this.player.friction;

        // Limit max speed
        const speed = Math.sqrt(this.player.vx ** 2 + this.player.vy ** 2);
        if (speed > this.player.maxSpeed) {
            this.player.vx = (this.player.vx / speed) * this.player.maxSpeed;
            this.player.vy = (this.player.vy / speed) * this.player.maxSpeed;
        }

        // Update position
        const newX = this.player.x + this.player.vx;
        const newY = this.player.y + this.player.vy;

        // Check if new position is on land (or flying)
        if (this.player.canFly && this.player.altitude > 0.5) {
            // Helicopter can fly over water
            this.player.x = newX;
            this.player.y = newY;
        } else if (this.isOnLand(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;

            // Check collision with palm trees (run over)
            if (!this.player.canFly || this.player.altitude < 0.5) {
                for (let tree of this.palmTrees) {
                    if (!tree.destroyed) {
                        const dist = Math.sqrt(
                            Math.pow(this.player.x - tree.x, 2) +
                            Math.pow(this.player.y - tree.y, 2)
                        );

                        if (dist < 0.5) {
                            tree.destroyed = true;
                            tree.leanAngle = this.player.angle;
                            tree.leanDirection = 1;
                            this.createParticles(tree.x, tree.y, '#8b4513', 15);
                        }
                    }
                }
            }
        } else {
            this.player.vx *= 0.5;
            this.player.vy *= 0.5;
        }

        // Keep player in bounds
        this.player.x = Math.max(0, Math.min(this.mapWidth - 1, this.player.x));
        this.player.y = Math.max(0, Math.min(this.mapHeight - 1, this.player.y));

        // Update camera to follow player
        this.camera.x = this.player.x;
        this.camera.y = this.player.y;

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.x += proj.vx;
            proj.y += proj.vy;
            proj.life--;

            let hitSomething = false;

            // Check collision with buildings
            for (let building of this.buildings) {
                if (!building.destroyed) {
                    const dist = Math.sqrt(
                        Math.pow(proj.x - building.x, 2) +
                        Math.pow(proj.y - building.y, 2)
                    );

                    if (dist < building.width / 2) {
                        building.hp -= proj.damage;
                        this.createParticles(building.x, building.y, '#f80', 10);

                        if (building.hp <= 0) {
                            building.destroyed = true;
                            this.destroyedCount++;
                            this.createParticles(building.x, building.y, '#f00', 30);

                            if (building.hasFlag) {
                                this.flagRevealed = true;
                            }

                            this.updateUI();
                        }

                        hitSomething = true;
                        break;
                    }
                }
            }

            // Check collision with palm trees
            if (!hitSomething) {
                for (let tree of this.palmTrees) {
                    if (!tree.destroyed && !tree.burning) {
                        const dist = Math.sqrt(
                            Math.pow(proj.x - tree.x, 2) +
                            Math.pow(proj.y - tree.y, 2)
                        );

                        if (dist < 0.4) {
                            tree.burning = true;
                            tree.burnTime = 100;
                            this.createParticles(tree.x, tree.y, '#f80', 15);
                            hitSomething = true;
                            break;
                        }
                    }
                }
            }

            // Remove projectile if hit something
            if (hitSomething) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Remove old projectiles
            if (proj.life <= 0 || (!this.player.canFly && !this.isOnLand(proj.x, proj.y))) {
                this.projectiles.splice(i, 1);
            }
        }

        // Update palm trees
        for (let i = this.palmTrees.length - 1; i >= 0; i--) {
            const tree = this.palmTrees[i];

            if (tree.burning) {
                tree.burnTime--;

                // Create fire particles
                if (Math.random() < 0.3) {
                    this.createParticles(tree.x, tree.y, '#f60', 3);
                }

                if (tree.burnTime <= 0) {
                    tree.destroyed = true;
                    tree.burning = false;
                    this.createParticles(tree.x, tree.y, '#222', 20);
                }
            }

            // Animate leaning for destroyed trees
            if (tree.destroyed && tree.leanDirection > 0) {
                tree.leanDirection += 0.02;
                if (tree.leanDirection >= Math.PI / 2) {
                    tree.leanDirection = -1; // Finished falling
                }
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.01; // Gravity
            p.life--;
            p.alpha = p.life / p.maxLife;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.2 + 0.1;

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30 + Math.random() * 30,
                maxLife: 60,
                alpha: 1,
                color: color
            });
        }
    }

    isOnLand(x, y) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);

        if (ty < 0 || ty >= this.mapHeight || tx < 0 || tx >= this.mapWidth) {
            return false;
        }

        return this.map[ty][tx].type === 'grass' || this.map[ty][tx].type === 'sand';
    }

    updateUI() {
        document.getElementById('destroyed-count').textContent = this.destroyedCount;

        let flagStatus = 'Hidden';
        if (this.gameWon) {
            flagStatus = 'MISSION COMPLETE!';
            document.getElementById('mission-status').textContent = 'Victory! Press F5 to play again';
            document.getElementById('mission-status').style.color = '#0f0';
        } else if (this.player.hasFlag) {
            flagStatus = 'CAPTURED - Return to base!';
            document.getElementById('mission-status').textContent = 'Return the flag to your base!';
        } else if (this.flagRevealed) {
            flagStatus = 'Located - Press E to capture';
        }

        document.getElementById('flag-status').textContent = flagStatus;
    }

    // Isometric conversion with height support
    toScreen(worldX, worldY, height = 0) {
        const isoX = (worldX - worldY) * this.tileWidth / 2;
        const isoY = (worldX + worldY) * this.tileHeight / 2;

        const screenX = this.canvas.width / 2 + isoX -
                       (this.camera.x - this.camera.y) * this.tileWidth / 2;
        const screenY = this.canvas.height / 2 + isoY -
                       (this.camera.x + this.camera.y) * this.tileHeight / 2 -
                       height * 20; // Height offset

        return { x: screenX, y: screenY };
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#001100';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Show vehicle selection screen if game hasn't started
        if (!this.gameStarted) {
            this.renderVehicleSelection();
            return;
        }

        // Calculate visible tiles
        const viewRange = 15;
        const startX = Math.max(0, Math.floor(this.camera.x - viewRange));
        const endX = Math.min(this.mapWidth, Math.ceil(this.camera.x + viewRange));
        const startY = Math.max(0, Math.floor(this.camera.y - viewRange));
        const endY = Math.min(this.mapHeight, Math.ceil(this.camera.y + viewRange));

        // Collect all renderable objects with their screen positions
        const renderQueue = [];

        // Add tiles to render queue
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = this.map[y][x];
                const screen = this.toScreen(x, y, tile.height);
                renderQueue.push({
                    type: 'tile',
                    tile: tile,
                    screen: screen,
                    sortY: y + x // For isometric sorting
                });
            }
        }

        // Add palm trees to render queue
        for (let tree of this.palmTrees) {
            if (tree.x >= startX && tree.x < endX &&
                tree.y >= startY && tree.y < endY) {
                const tileHeight = this.getTileHeight(tree.x, tree.y);
                const screen = this.toScreen(tree.x, tree.y, tileHeight);
                renderQueue.push({
                    type: 'palmtree',
                    tree: tree,
                    screen: screen,
                    sortY: tree.y + tree.x
                });
            }
        }

        // Add buildings to render queue
        for (let building of this.buildings) {
            if (building.x >= startX && building.x < endX &&
                building.y >= startY && building.y < endY) {
                const tileHeight = this.getTileHeight(building.x, building.y);
                const screen = this.toScreen(building.x, building.y, tileHeight);
                renderQueue.push({
                    type: 'building',
                    building: building,
                    screen: screen,
                    sortY: building.y + building.x
                });
            }
        }

        // Add home base
        const homeTileHeight = this.getTileHeight(this.homeBase.x, this.homeBase.y);
        const homeScreen = this.toScreen(this.homeBase.x, this.homeBase.y, homeTileHeight);
        renderQueue.push({
            type: 'homebase',
            screen: homeScreen,
            sortY: this.homeBase.y + this.homeBase.x
        });

        // Add player to render queue
        const playerTileHeight = this.getTileHeight(this.player.x, this.player.y);
        const playerScreen = this.toScreen(this.player.x, this.player.y, playerTileHeight + this.player.altitude);
        renderQueue.push({
            type: 'player',
            screen: playerScreen,
            sortY: this.player.y + this.player.x
        });

        // Add projectiles to render queue
        for (let proj of this.projectiles) {
            const projTileHeight = this.getTileHeight(proj.x, proj.y);
            const screen = this.toScreen(proj.x, proj.y, projTileHeight);
            renderQueue.push({
                type: 'projectile',
                projectile: proj,
                screen: screen,
                sortY: proj.y + proj.x
            });
        }

        // Add particles to render queue
        for (let p of this.particles) {
            const particleTileHeight = this.getTileHeight(p.x, p.y);
            const screen = this.toScreen(p.x, p.y, particleTileHeight);
            renderQueue.push({
                type: 'particle',
                particle: p,
                screen: screen,
                sortY: p.y + p.x
            });
        }

        // Sort by isometric depth
        renderQueue.sort((a, b) => a.sortY - b.sortY);

        // Render all objects
        for (let obj of renderQueue) {
            switch (obj.type) {
                case 'tile':
                    this.renderTile(obj.tile, obj.screen);
                    break;
                case 'palmtree':
                    this.renderPalmTree(obj.tree, obj.screen);
                    break;
                case 'building':
                    this.renderBuilding(obj.building, obj.screen);
                    break;
                case 'homebase':
                    this.renderHomeBase(obj.screen);
                    break;
                case 'player':
                    this.renderPlayer(obj.screen);
                    break;
                case 'projectile':
                    this.renderProjectile(obj.projectile, obj.screen);
                    break;
                case 'particle':
                    this.renderParticle(obj.particle, obj.screen);
                    break;
            }
        }
    }

    getTileHeight(x, y) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);

        if (ty < 0 || ty >= this.mapHeight || tx < 0 || tx >= this.mapWidth) {
            return 0;
        }

        return this.map[ty][tx].height || 0;
    }

    renderTile(tile, screen) {
        // Draw isometric tile
        const hw = this.tileWidth / 2;
        const hh = this.tileHeight / 2;

        // Draw tile top
        this.ctx.beginPath();
        this.ctx.moveTo(screen.x, screen.y - hh);
        this.ctx.lineTo(screen.x + hw, screen.y);
        this.ctx.lineTo(screen.x, screen.y + hh);
        this.ctx.lineTo(screen.x - hw, screen.y);
        this.ctx.closePath();

        if (tile.type === 'grass') {
            this.ctx.fillStyle = '#2a4a2a';
            this.ctx.fill();
            this.ctx.strokeStyle = '#1a3a1a';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        } else if (tile.type === 'sand') {
            this.ctx.fillStyle = '#c2b280';
            this.ctx.fill();
            this.ctx.strokeStyle = '#a89968';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        } else {
            this.ctx.fillStyle = '#0a2a5a';
            this.ctx.fill();
            this.ctx.strokeStyle = '#0a1a3a';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // Draw 3D sides for elevated tiles
        if (tile.height > 0) {
            const depth = tile.height * 20;

            // Left side
            this.ctx.beginPath();
            this.ctx.moveTo(screen.x - hw, screen.y);
            this.ctx.lineTo(screen.x - hw, screen.y + depth);
            this.ctx.lineTo(screen.x, screen.y + hh + depth);
            this.ctx.lineTo(screen.x, screen.y + hh);
            this.ctx.closePath();

            if (tile.type === 'grass') {
                this.ctx.fillStyle = '#1a3a1a';
            } else if (tile.type === 'sand') {
                this.ctx.fillStyle = '#a89968';
            } else {
                this.ctx.fillStyle = '#0a1a3a';
            }
            this.ctx.fill();

            // Right side
            this.ctx.beginPath();
            this.ctx.moveTo(screen.x + hw, screen.y);
            this.ctx.lineTo(screen.x + hw, screen.y + depth);
            this.ctx.lineTo(screen.x, screen.y + hh + depth);
            this.ctx.lineTo(screen.x, screen.y + hh);
            this.ctx.closePath();

            if (tile.type === 'grass') {
                this.ctx.fillStyle = '#0f2a0f';
            } else if (tile.type === 'sand') {
                this.ctx.fillStyle = '#968850';
            } else {
                this.ctx.fillStyle = '#081a2a';
            }
            this.ctx.fill();
        }
    }

    renderBuilding(building, screen) {
        if (building.destroyed) {
            // Render rubble
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(screen.x - 10, screen.y - 5, 20, 10);

            // Draw flag if it has one and is revealed
            if (building.hasFlag && !this.flagCaptured) {
                this.ctx.fillStyle = '#ff0';
                this.ctx.beginPath();
                this.ctx.arc(screen.x, screen.y - 20, 8, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.strokeStyle = '#ff0';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(screen.x, screen.y - 12);
                this.ctx.lineTo(screen.x, screen.y);
                this.ctx.stroke();
            }
        } else {
            // Render intact building
            const buildingHeight = building.type === 'tower' ? 40 : 25;

            // Building body
            this.ctx.fillStyle = building.hp === building.maxHp ? '#666' : '#833';
            this.ctx.fillRect(screen.x - 15, screen.y - buildingHeight, 30, buildingHeight);

            // Building top (isometric)
            this.ctx.fillStyle = building.hp === building.maxHp ? '#888' : '#a55';
            this.ctx.beginPath();
            this.ctx.moveTo(screen.x, screen.y - buildingHeight - 10);
            this.ctx.lineTo(screen.x + 15, screen.y - buildingHeight - 5);
            this.ctx.lineTo(screen.x + 15, screen.y - buildingHeight + 5);
            this.ctx.lineTo(screen.x, screen.y - buildingHeight);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(screen.x, screen.y - buildingHeight - 10);
            this.ctx.lineTo(screen.x - 15, screen.y - buildingHeight - 5);
            this.ctx.lineTo(screen.x - 15, screen.y - buildingHeight + 5);
            this.ctx.lineTo(screen.x, screen.y - buildingHeight);
            this.ctx.closePath();
            this.ctx.fillStyle = building.hp === building.maxHp ? '#555' : '#722';
            this.ctx.fill();

            // HP bar
            if (building.hp < building.maxHp) {
                const barWidth = 30;
                const barHeight = 3;
                this.ctx.fillStyle = '#f00';
                this.ctx.fillRect(screen.x - barWidth/2, screen.y - buildingHeight - 15, barWidth, barHeight);
                this.ctx.fillStyle = '#0f0';
                this.ctx.fillRect(screen.x - barWidth/2, screen.y - buildingHeight - 15,
                                 barWidth * (building.hp / building.maxHp), barHeight);
            }
        }
    }

    renderHomeBase(screen) {
        // Draw home base as a green circle
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, this.homeBase.radius * this.tileWidth / 2, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw base marker
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HOME', screen.x, screen.y - 30);
    }

    renderPlayer(screen) {
        this.ctx.save();
        this.ctx.translate(screen.x, screen.y);

        // Draw shadow if flying
        if (this.player.altitude > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.beginPath();
            const shadowSize = 20 + this.player.altitude * 5;
            this.ctx.ellipse(0, this.player.altitude * 20, shadowSize, shadowSize / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Render based on vehicle type
        if (this.player.vehicleType === 'tank') {
            // Draw tank
            this.ctx.fillStyle = '#4a5a4a';
            this.ctx.fillRect(-18, -12, 36, 24);

            // Draw turret
            this.ctx.fillStyle = '#5a6a5a';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw cannon
            this.ctx.strokeStyle = '#3a4a3a';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(Math.cos(this.player.angle) * 25, Math.sin(this.player.angle) * 25);
            this.ctx.stroke();

            // Draw tracks
            this.ctx.fillStyle = '#2a3a2a';
            this.ctx.fillRect(-18, -14, 36, 3);
            this.ctx.fillRect(-18, 11, 36, 3);

        } else if (this.player.vehicleType === 'hummer') {
            // Draw hummer body
            this.ctx.fillStyle = '#4a4a2a';
            this.ctx.fillRect(-15, -10, 30, 20);

            // Draw cabin
            this.ctx.fillStyle = '#2a2a1a';
            this.ctx.fillRect(-10, -6, 20, 12);

            // Draw wheels
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.beginPath();
            this.ctx.arc(-10, -10, 3, 0, Math.PI * 2);
            this.ctx.arc(10, -10, 3, 0, Math.PI * 2);
            this.ctx.arc(-10, 10, 3, 0, Math.PI * 2);
            this.ctx.arc(10, 10, 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw direction indicator
            this.ctx.strokeStyle = '#0f0';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(Math.cos(this.player.angle) * 20, Math.sin(this.player.angle) * 20);
            this.ctx.stroke();

        } else if (this.player.vehicleType === 'helicopter') {
            // Draw helicopter body
            this.ctx.fillStyle = '#3a3a5a';
            this.ctx.fillRect(-12, -8, 24, 16);

            // Draw cockpit
            this.ctx.fillStyle = '#1a1a3a';
            this.ctx.fillRect(-8, -6, 16, 12);

            // Draw tail
            this.ctx.fillStyle = '#3a3a5a';
            this.ctx.fillRect(12, -2, 15, 4);

            // Draw main rotor (spinning)
            this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            this.ctx.lineWidth = 2;
            const rotorAngle = Date.now() * 0.05;
            this.ctx.beginPath();
            this.ctx.moveTo(Math.cos(rotorAngle) * 25, Math.sin(rotorAngle) * 25);
            this.ctx.lineTo(Math.cos(rotorAngle + Math.PI) * 25, Math.sin(rotorAngle + Math.PI) * 25);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(Math.cos(rotorAngle + Math.PI/2) * 25, Math.sin(rotorAngle + Math.PI/2) * 25);
            this.ctx.lineTo(Math.cos(rotorAngle + Math.PI*1.5) * 25, Math.sin(rotorAngle + Math.PI*1.5) * 25);
            this.ctx.stroke();

            // Draw tail rotor
            this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(27, -5);
            this.ctx.lineTo(27, 5);
            this.ctx.stroke();
        }

        // Draw flag if carrying
        if (this.player.hasFlag) {
            this.ctx.fillStyle = '#ff0';
            this.ctx.beginPath();
            this.ctx.arc(0, -25, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    renderPalmTree(tree, screen) {
        this.ctx.save();
        this.ctx.translate(screen.x, screen.y);

        if (tree.destroyed && tree.leanDirection === -1) {
            // Fully fallen tree - draw as log
            this.ctx.fillStyle = '#6b4423';
            this.ctx.fillRect(-tree.height * 10, -3, tree.height * 20, 6);
        } else {
            // Apply lean if falling
            if (tree.leanDirection > 0) {
                this.ctx.rotate(tree.leanDirection);
            }

            // Draw trunk
            const trunkHeight = tree.height * 20;
            this.ctx.fillStyle = tree.burning ? '#8b3413' : '#6b4423';
            this.ctx.fillRect(-3, -trunkHeight, 6, trunkHeight);

            // Draw palm fronds (polygonal)
            if (!tree.destroyed) {
                const frondColor = tree.burning ? '#fa4' : '#2a5a2a';
                this.ctx.fillStyle = frondColor;

                // Draw 6 fronds in a star pattern
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const length = 15;

                    this.ctx.beginPath();
                    this.ctx.moveTo(0, -trunkHeight);
                    this.ctx.lineTo(
                        Math.cos(angle) * length,
                        -trunkHeight + Math.sin(angle) * length
                    );
                    this.ctx.lineTo(
                        Math.cos(angle) * length * 0.5,
                        -trunkHeight + Math.sin(angle) * length * 0.5 - 5
                    );
                    this.ctx.closePath();
                    this.ctx.fill();
                }

                // Draw coconuts
                this.ctx.fillStyle = '#8b6423';
                for (let i = 0; i < 3; i++) {
                    const cAngle = (i / 3) * Math.PI * 2;
                    this.ctx.beginPath();
                    this.ctx.arc(
                        Math.cos(cAngle) * 5,
                        -trunkHeight + Math.sin(cAngle) * 5,
                        3, 0, Math.PI * 2
                    );
                    this.ctx.fill();
                }
            }

            // Draw fire particles if burning
            if (tree.burning) {
                for (let i = 0; i < 5; i++) {
                    this.ctx.fillStyle = Math.random() > 0.5 ? '#f60' : '#f80';
                    this.ctx.beginPath();
                    this.ctx.arc(
                        (Math.random() - 0.5) * 10,
                        -trunkHeight - Math.random() * 10,
                        2 + Math.random() * 2,
                        0, Math.PI * 2
                    );
                    this.ctx.fill();
                }
            }
        }

        this.ctx.restore();
    }

    renderVehicleSelection() {
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = 'bold 48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SELECT YOUR VEHICLE', this.canvas.width / 2, 100);

        this.ctx.font = '20px monospace';
        this.ctx.fillText('Click on a vehicle to begin', this.canvas.width / 2, 140);

        const centerY = this.canvas.height / 2;
        const spacing = 300;

        // Draw Tank
        this.drawVehicleOption('tank', this.canvas.width / 2 - spacing, centerY);

        // Draw Hummer
        this.drawVehicleOption('hummer', this.canvas.width / 2, centerY);

        // Draw Helicopter
        this.drawVehicleOption('helicopter', this.canvas.width / 2 + spacing, centerY);
    }

    drawVehicleOption(type, x, y) {
        this.ctx.save();
        this.ctx.translate(x, y);

        // Draw selection circle
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 70, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw vehicle preview
        const scale = 1.5;
        this.ctx.scale(scale, scale);

        if (type === 'tank') {
            this.ctx.fillStyle = '#4a5a4a';
            this.ctx.fillRect(-18, -12, 36, 24);
            this.ctx.fillStyle = '#5a6a5a';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#3a4a3a';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(25, 0);
            this.ctx.stroke();
        } else if (type === 'hummer') {
            this.ctx.fillStyle = '#4a4a2a';
            this.ctx.fillRect(-15, -10, 30, 20);
            this.ctx.fillStyle = '#2a2a1a';
            this.ctx.fillRect(-10, -6, 20, 12);
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.beginPath();
            this.ctx.arc(-10, -10, 3, 0, Math.PI * 2);
            this.ctx.arc(10, -10, 3, 0, Math.PI * 2);
            this.ctx.arc(-10, 10, 3, 0, Math.PI * 2);
            this.ctx.arc(10, 10, 3, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === 'helicopter') {
            this.ctx.fillStyle = '#3a3a5a';
            this.ctx.fillRect(-12, -8, 24, 16);
            this.ctx.fillStyle = '#1a1a3a';
            this.ctx.fillRect(-8, -6, 16, 12);
            this.ctx.fillRect(12, -2, 15, 4);
            this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-25, 0);
            this.ctx.lineTo(25, 0);
            this.ctx.stroke();
        }

        this.ctx.restore();

        // Draw vehicle name
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = 'bold 20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.vehicleTypes[type].name.toUpperCase(), x, y + 100);

        // Draw vehicle stats
        this.ctx.font = '14px monospace';
        const stats = this.vehicleTypes[type];
        this.ctx.fillText(`Speed: ${Math.round(stats.maxSpeed * 100)}`, x, y + 125);
        this.ctx.fillText(`Fire Rate: ${Math.round(100 / stats.fireRate)}`, x, y + 145);
        this.ctx.fillText(`Damage: ${stats.damage}`, x, y + 165);
    }

    renderProjectile(proj, screen) {
        this.ctx.fillStyle = '#ff0';
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    renderParticle(p, screen) {
        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
    }

    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (this.gameStarted && !this.gameWon) {
            this.update(deltaTime);
        }
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Start game when page loads
window.addEventListener('load', () => {
    new Game();
});
