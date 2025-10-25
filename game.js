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
        this.destroyedCount = 0;
        this.flagRevealed = false;
        this.flagCaptured = false;
        this.gameWon = false;

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

        // Initialize
        this.initMap();
        this.initPlayer();
        this.initBuildings();
        this.initEventListeners();
        this.lastTime = 0;

        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    initMap() {
        // Create tile map with islands
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

                this.map[y][x] = {
                    type: isLand ? 'grass' : 'water',
                    x: x,
                    y: y
                };
            }
        }
    }

    initPlayer() {
        this.player = {
            x: this.mapWidth / 2,
            y: this.mapHeight / 2,
            vx: 0,
            vy: 0,
            angle: 0,
            speed: 0.1,
            maxSpeed: 0.2,
            friction: 0.95,
            size: 0.8,
            hasFlag: false,
            weapon: {
                cooldown: 0,
                maxCooldown: 20
            }
        };
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
        window.addEventListener('keydown', (e) => {
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
            vx: Math.cos(this.player.angle) * 0.5,
            vy: Math.sin(this.player.angle) * 0.5,
            life: 60,
            damage: 1
        };

        this.projectiles.push(projectile);
    }

    update(deltaTime) {
        // Update weapon cooldown
        if (this.player.weapon.cooldown > 0) {
            this.player.weapon.cooldown--;
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

        // Check if new position is on land
        if (this.isOnLand(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;
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

                        this.projectiles.splice(i, 1);
                        break;
                    }
                }
            }

            // Remove old projectiles
            if (proj.life <= 0 || !this.isOnLand(proj.x, proj.y)) {
                this.projectiles.splice(i, 1);
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

        return this.map[ty][tx].type === 'grass';
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

    // Isometric conversion
    toScreen(worldX, worldY) {
        const isoX = (worldX - worldY) * this.tileWidth / 2;
        const isoY = (worldX + worldY) * this.tileHeight / 2;

        const screenX = this.canvas.width / 2 + isoX -
                       (this.camera.x - this.camera.y) * this.tileWidth / 2;
        const screenY = this.canvas.height / 2 + isoY -
                       (this.camera.x + this.camera.y) * this.tileHeight / 2;

        return { x: screenX, y: screenY };
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#001100';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
                const screen = this.toScreen(x, y);
                renderQueue.push({
                    type: 'tile',
                    tile: tile,
                    screen: screen,
                    sortY: y + x // For isometric sorting
                });
            }
        }

        // Add buildings to render queue
        for (let building of this.buildings) {
            if (building.x >= startX && building.x < endX &&
                building.y >= startY && building.y < endY) {
                const screen = this.toScreen(building.x, building.y);
                renderQueue.push({
                    type: 'building',
                    building: building,
                    screen: screen,
                    sortY: building.y + building.x
                });
            }
        }

        // Add home base
        const homeScreen = this.toScreen(this.homeBase.x, this.homeBase.y);
        renderQueue.push({
            type: 'homebase',
            screen: homeScreen,
            sortY: this.homeBase.y + this.homeBase.x
        });

        // Add player to render queue
        const playerScreen = this.toScreen(this.player.x, this.player.y);
        renderQueue.push({
            type: 'player',
            screen: playerScreen,
            sortY: this.player.y + this.player.x
        });

        // Add projectiles to render queue
        for (let proj of this.projectiles) {
            const screen = this.toScreen(proj.x, proj.y);
            renderQueue.push({
                type: 'projectile',
                projectile: proj,
                screen: screen,
                sortY: proj.y + proj.x
            });
        }

        // Add particles to render queue
        for (let p of this.particles) {
            const screen = this.toScreen(p.x, p.y);
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

    renderTile(tile, screen) {
        // Draw isometric tile
        const hw = this.tileWidth / 2;
        const hh = this.tileHeight / 2;

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
        } else {
            this.ctx.fillStyle = '#0a2a5a';
            this.ctx.fill();
            this.ctx.strokeStyle = '#0a1a3a';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
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

        // Draw vehicle body (simplified hummer)
        this.ctx.fillStyle = '#4a4a2a';
        this.ctx.fillRect(-15, -10, 30, 20);

        // Draw cabin
        this.ctx.fillStyle = '#2a2a1a';
        this.ctx.fillRect(-10, -6, 20, 12);

        // Draw direction indicator
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(Math.cos(this.player.angle) * 20, Math.sin(this.player.angle) * 20);
        this.ctx.stroke();

        // Draw flag if carrying
        if (this.player.hasFlag) {
            this.ctx.fillStyle = '#ff0';
            this.ctx.beginPath();
            this.ctx.arc(0, -25, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
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

        if (!this.gameWon) {
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
