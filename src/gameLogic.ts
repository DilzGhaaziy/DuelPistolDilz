import { GameState, Pistol } from './types';
import { AudioEngine } from './audio';

let nextEnemyId = 1;

export function initWave(game: GameState, isFirstWave: boolean, width: number, height: number) {
    game.bullets = [];
    game.particles = [];
    
    let player = game.pistols.find(p => p.isPlayer);
    if (!player || isFirstWave) {
        player = {
            id: 0,
            x: width * 0.2,
            y: height * 0.5,
            vx: 0,
            vy: 0,
            angle: 0, 
            vAngle: 0,
            lives: 2,
            isPlayer: true,
            scale: 1.2,
            cooldown: 0
        };
        game.pistols = [player];
    } else {
        player.lives = 2; // heal back to full
        player.x = width * 0.2;
        player.y = height * 0.5;
        player.vy = 0;
        player.vx = 0;
        player.angle = 0;
        player.vAngle = 0;
        game.pistols = [player];
    }
    
    // Spawn 1 to 4 enemies depending on score, or 1 for the first round
    const maxEnemies = game.score >= 500 ? 4 : 3;
    const numEnemies = isFirstWave ? 1 : Math.floor(Math.random() * maxEnemies) + 1;
    // If >= 2 enemies, scale down
    const enemyScale = numEnemies >= 2 ? 0.85 : 1.2;
    
    for (let i = 0; i < numEnemies; i++) {
        game.pistols.push({
            id: nextEnemyId++,
            x: width * 0.7 + Math.random() * (width * 0.2),
            y: height * 0.2 + (i * (height * 0.6) / numEnemies) + Math.random() * (height * 0.1),
            vx: 0,
            vy: 0,
            angle: Math.PI, // Facing left
            vAngle: 0,
            lives: 2,
            isPlayer: false,
            scale: enemyScale,
            cooldown: Math.random() * 60,
            timeNotFacingPlayer: 0
        });
    }
}

export function shootWeapon(p: Pistol, game: GameState, audio: AudioEngine) {
    if (p.lives <= 0) return;

    const muzzleDist = 45 * p.scale;
    const bx = p.x + Math.cos(p.angle) * muzzleDist;
    const by = p.y + Math.sin(p.angle) * muzzleDist;
    
    game.bullets.push({
        x: bx, y: by,
        vx: Math.cos(p.angle) * (15 * (1/p.scale)), // normalized speed
        vy: Math.sin(p.angle) * (15 * (1/p.scale)),
        ownerId: p.id,
        history: []
    });
    
    // Recoil (Push back gently, pull vertical up strongly, and smooth rotation)
    p.vx -= Math.cos(p.angle) * 4;
    p.vy = -7; 
    p.vAngle += p.isPlayer ? -0.015 : 0.015; 
    
    // Muzzle flash particles
    for (let i = 0; i < 8; i++) {
        game.particles.push({
            x: bx, y: by,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: '#fef08a'
        });
    }
    
    audio.playShoot(p.isPlayer);
}

export function updateGameState(game: GameState, audio: AudioEngine, width: number, height: number, onSync: (s: any) => void) {
    if (game.state !== 'PLAYING') return;

    const GRAVITY = 0.4;
    const player = game.pistols.find(p => p.isPlayer);
    
    if (player && player.lives <= 0) {
        game.state = 'GAME_OVER';
        audio.stopBGM();
        onSync({ lives: 0, score: game.score });
        return;
    }
    
    let isSlowmo = false;
    let isNearMiss = false;
    
    if (game.slowmoTime && game.slowmoTime > 0) {
        isSlowmo = true;
        game.slowmoTime -= 1;
    } else {
        for (const b of game.bullets) {
            for (const p of game.pistols) {
                if (p.lives <= 0) continue;
                if (p.id !== 0 && b.ownerId !== 0) continue; // Enemy bullets don't slowmo other enemies
                const dist = Math.hypot(b.x - p.x, b.y - p.y);
                // Detect if bullet is near an oppossing pistol
                if (dist < 75 * p.scale && b.ownerId !== p.id) {
                    isSlowmo = true;
                    isNearMiss = true;
                    break;
                }
            }
            if (isSlowmo) break;
        }
    }
    
    if (isNearMiss && !game.wasSlowmo) {
        // Only play if it's not already playing (wasSlowmo tracks previous frame state)
        // If slowmoTime just got set, or near miss just started, play the sound
        audio.playSlowmo(2.0); 
    }
    game.wasSlowmo = isSlowmo;
    
    let ts = isSlowmo ? 0.15 : 1.0;
    
    const enemies = game.pistols.filter(p => !p.isPlayer);
    const enemiesAlive = enemies.some(e => e.lives > 0);
    
    if (!enemiesAlive && !game.waveTransitioning && enemies.length > 0) {
        game.waveTransitioning = true;
        game.score += 100;
        if (player) {
            game.floatingTexts.push({ x: player.x, y: player.y - 80, text: "+100", color: "#38bdf8", life: 2.0 });
        }
        onSync({ lives: player!.lives, score: game.score });
        
        setTimeout(() => {
            initWave(game, false, width, height);
            game.waveTransitioning = false;
        }, 1500);
    }
    
    for (let p of game.pistols) {
        if (p.lives <= 0) continue;
        
        p.vy += GRAVITY * ts;
        p.y += p.vy * ts;
        p.x += p.vx * ts;
        p.vx *= Math.pow(0.95, ts); // horizontal friction
        
        p.angle += p.vAngle * ts;
        // Dampen the spin heavily so rotation occurs slowly and comes to rest
        p.vAngle *= Math.pow(0.90, ts); 
        
        // Physics collision with walls via exact boundary mass points
        const massPoints = [
            { x: 45, y: -12 }, // Muzzle Top
            { x: 45, y: 6 },   // Muzzle Bottom
            { x: -10, y: -12 },// Slide Back Top
            { x: -20, y: 36 }, // Grip Heel
            { x: -1, y: 42 }   // Grip Toe
        ];
        
        for (const pt of massPoints) {
            const py = !p.isPlayer ? -pt.y : pt.y; // Flip Y for enemies to match visuals
            const rx = (pt.x * Math.cos(p.angle) - py * Math.sin(p.angle)) * p.scale;
            const ry = (pt.x * Math.sin(p.angle) + py * Math.cos(p.angle)) * p.scale;
            const ptX = p.x + rx;
            const ptY = p.y + ry;
            
            const resolveCollision = (nx: number, ny: number, pen: number) => {
                p.x += nx * pen;
                p.y += ny * pen;
                
                const vpX = p.vx - p.vAngle * ry;
                const vpY = p.vy + p.vAngle * rx;
                const vNormal = vpX * nx + vpY * ny;
                if (vNormal > 0) return;
                
                const e = 0.5; // restitution (slightly less bouncy)
                const m = 1;
                const I = 3000 * p.scale * p.scale; // increased moment of inertia
                
                const rCrossN = rx * ny - ry * nx;
                const j = -(1 + e) * vNormal / (1/m + (rCrossN * rCrossN) / I);
                
                p.vx += (j * nx) / m;
                p.vy += (j * ny) / m;
                // Add only a fraction of the physical torque to keep rotation slow and controlled
                p.vAngle += ((rCrossN * j) / I) * 0.15;
            };

            const margin = 0;
            if (ptX < margin) resolveCollision(1, 0, margin - ptX);
            else if (ptX > width - margin) resolveCollision(-1, 0, ptX - (width - margin));
            
            if (ptY < margin) resolveCollision(0, 1, margin - ptY);
            else if (ptY > height - margin) resolveCollision(0, -1, ptY - (height - margin));
        }
        
        // AI Logic
        if (!p.isPlayer && player && player.lives > 0) {
            p.cooldown -= ts;
            
            // Calculate angle to player
            const angleToPlayer = Math.atan2(player.y - p.y, player.x - p.x);
            // Difference in angles (normalized between -PI and +PI)
            const diff = Math.atan2(Math.sin(p.angle - angleToPlayer), Math.cos(p.angle - angleToPlayer));

            if (Math.abs(diff) < 0.3) {
                // Facing player
                if (p.cooldown <= 0) {
                    shootWeapon(p, game, audio);
                    p.cooldown = 15 + Math.random() * 15;
                    p.timeNotFacingPlayer = 0;
                }
            } else {
                // Not facing player
                p.timeNotFacingPlayer = (p.timeNotFacingPlayer || 0) + ts;
                if (p.timeNotFacingPlayer > 120) { // 2 seconds
                    if (p.cooldown <= 0) {
                        shootWeapon(p, game, audio);
                        p.cooldown = 20; // Slight delay before next corrective shot
                    }
                }
            }
        }
    }
    
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        
        b.history.push({ x: b.x, y: b.y });
        
        while (b.history.length > 2 && Math.hypot(b.x - b.history[0].x, b.y - b.history[0].y) > 250) {
            b.history.shift();
        }
        
        b.x += b.vx * ts;
        b.y += b.vy * ts;
        
        // Near miss logic
        if (b.ownerId !== 0 && player && player.lives > 0) {
            const distToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
            if (!b.nearMissMarked && distToPlayer < 75 * player.scale) {
                b.nearMissMarked = true;
            } else if (b.nearMissMarked && distToPlayer > 75 * player.scale) {
                b.nearMissMarked = false; // Reset to avoid multiple triggers
                game.score += 5;
                game.floatingTexts.push({ x: player.x, y: player.y - 80, text: "+5", color: "#38bdf8", life: 2.0 });
                onSync({ lives: player.lives, score: game.score });
            }
        }
        
        // Precise hitbox detection
        for (let p of game.pistols) {
            if (p.lives <= 0 || b.ownerId === p.id) continue;
            
            // Transform bullet to pistol's local space
            const dx = b.x - p.x;
            const dy = b.y - p.y;
            
            // Un-rotate
            let localX = dx * Math.cos(-p.angle) - dy * Math.sin(-p.angle);
            let localY = dx * Math.sin(-p.angle) + dy * Math.cos(-p.angle);
            
            // Un-scale
            localX /= p.scale;
            localY /= p.scale;
            
            // Un-flip (enemies are flipped visually via ctx.scale(1, -1))
            if (!p.isPlayer) {
                localY = -localY;
            }
            
            // Bullet radius in local space (radius is about 6 for 150% size bullet)
            const padding = 6 / p.scale;
            
            // 1. Barrel Hitbox
            // ctx.roundRect(-10, -12, 55, 18, 4);
            const hitBarrel = localX >= -10 - padding && localX <= 45 + padding && localY >= -12 - padding && localY <= 6 + padding;
            
            // 2. Grip Hitbox
            // ctx.translate(2, 6); ctx.rotate(Math.PI / 10); ctx.roundRect(-12, 0, 20, 35, 3);
            const gx = localX - 2;
            const gy = localY - 6;
            const gripAngle = -Math.PI / 10; // Un-rotate the grip
            const gripLocalX = gx * Math.cos(gripAngle) - gy * Math.sin(gripAngle);
            const gripLocalY = gx * Math.sin(gripAngle) + gy * Math.cos(gripAngle);
            
            const hitGrip = gripLocalX >= -12 - padding && gripLocalX <= 8 + padding && gripLocalY >= 0 - padding && gripLocalY <= 35 + padding;
            
            if (hitBarrel || hitGrip) {
                b.dead = true;
                p.lives -= 1;
                
                // Knockback
                p.vx += b.vx * 0.4;
                p.vy += b.vy * 0.4;
                
                if (b.ownerId === 0 && !p.isPlayer) {
                    if (p.lives <= 0) {
                        game.score += 50;
                        game.floatingTexts.push({ x: p.x, y: p.y - 65, text: "+50", color: "#38bdf8", life: 2.0 });
                    } else {
                        game.score += 20;
                        game.floatingTexts.push({ x: p.x, y: p.y - 65, text: "+20", color: "#38bdf8", life: 2.0 });
                    }
                    onSync({ lives: player!.lives, score: game.score });
                } else if (p.isPlayer) {
                    game.score -= 20;
                    game.floatingTexts.push({ x: p.x, y: p.y - 80, text: "-20", color: "#f87171", life: 2.0 });
                    onSync({ lives: p.lives, score: game.score });
                }
                
                if (p.lives <= 0) {
                    audio.playDeath();
                } else {
                    audio.playHit();
                }
                
                for (let k = 0; k < 15; k++) {
                    game.particles.push({
                        x: b.x, y: b.y,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10,
                        life: 1.0,
                        color: p.isPlayer ? '#ef4444' : '#f97316'
                    });
                }
                break;
            }
        }
        
        if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
            b.dead = true;
        }
    }
    
    // Bullet-bullet collision logic
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b1 = game.bullets[i];
        if (b1.dead) continue;
        for (let j = i - 1; j >= 0; j--) {
            const b2 = game.bullets[j];
            if (b2.dead) continue;
            
            if ((b1.ownerId === 0 && b2.ownerId !== 0) || (b1.ownerId !== 0 && b2.ownerId === 0)) {
                if (Math.hypot(b1.x - b2.x, b1.y - b2.y) < 30) {
                    b1.dead = true;
                    b2.dead = true;
                    
                    // Award 5 points for colliding with enemy bullet
                    game.score += 5;
                    game.floatingTexts.push({ x: b1.x, y: b1.y - 20, text: "+5", color: "#38bdf8", life: 2.0 });
                    if (player) {
                        onSync({ lives: player.lives, score: game.score });
                    }
                    
                    // Trigger bullet slowmo
                    game.slowmoTime = 120;
                    
                    audio.playBulletCollision();
                    // Blue explosion (player bullet)
                    for (let k = 0; k < 10; k++) {
                        game.particles.push({
                            x: b1.x, y: b1.y,
                            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                            life: 1.0, color: '#38bdf8'
                        });
                    }
                    // Red explosion (enemy bullet)
                    for (let k = 0; k < 10; k++) {
                        game.particles.push({
                            x: b2.x, y: b2.y,
                            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                            life: 1.0, color: '#f87171'
                        });
                    }
                }
            }
        }
    }
    
    game.bullets = game.bullets.filter(b => !b.dead);
    
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const pt = game.particles[i];
        pt.x += pt.vx * ts;
        pt.y += pt.vy * ts;
        pt.life -= 0.05 * ts;
    }
    game.particles = game.particles.filter(pt => pt.life > 0);
    
    // Update floating texts
    for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
        const ft = game.floatingTexts[i];
        ft.y -= 1 * ts; // slowly float up
        ft.life -= 0.016 * ts; // assume ~60fps, 2 seconds is roughly life down by 0.016
    }
    game.floatingTexts = game.floatingTexts.filter(ft => ft.life > 0);
}

export function drawGame(ctx: CanvasRenderingContext2D, game: GameState, width: number, height: number) {
    ctx.clearRect(0, 0, width, height);
    
    for (let pt of game.particles) {
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 4, 4);
    }
    ctx.globalAlpha = 1.0;
    
    for (let b of game.bullets) {
        const isPlayer = b.ownerId === 0;
        const color = isPlayer ? '#38bdf8' : '#f87171';
        const darkColor = isPlayer ? '#0284c7' : '#991b1b';
        
        // Draw traces
        if (b.history && b.history.length > 0) {
            ctx.beginPath();
            ctx.moveTo(b.history[0].x, b.history[0].y);
            for (let i = 1; i < b.history.length; i++) {
                ctx.lineTo(b.history[i].x, b.history[i].y);
            }
            ctx.lineTo(b.x, b.y);
            
            const oldest = b.history[0];
            const grad = ctx.createLinearGradient(oldest.x, oldest.y, b.x, b.y);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, isPlayer ? 'rgba(56,189,248,0.6)' : 'rgba(248,113,113,0.6)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
        
        // Draw 3D Bullet 
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        
        const bulletGrad = ctx.createLinearGradient(0, -4.5, 0, 4.5);
        bulletGrad.addColorStop(0, darkColor);
        bulletGrad.addColorStop(0.3, '#ffffff');
        bulletGrad.addColorStop(1, darkColor);
        
        ctx.fillStyle = bulletGrad;
        ctx.beginPath();
        ctx.roundRect(-12, -4.5, 24, 9, 3);
        ctx.fill();
        
        // Rim light
        ctx.strokeStyle = isPlayer ? 'rgba(125,211,252,0.8)' : 'rgba(252,165,165,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-12, -4.5, 24, 9, 3);
        ctx.stroke();

        ctx.restore();
    }
    
    for (let p of game.pistols) {
        if (p.lives <= 0) continue;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(p.scale, p.scale);
        
        // Ensure pistol player always points right visually and enemy left visually
        let flipped = !p.isPlayer; 
        if (flipped) {
            ctx.scale(1, -1);
        }
        
        for(let i=3; i>0; i--) {
            ctx.save();
            ctx.translate(i*2, i*2);
            drawPistolShape(ctx, p.isPlayer, true);
            ctx.restore();
        }
        drawPistolShape(ctx, p.isPlayer, false);
        ctx.restore();
        
        // HP Bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(p.x - 20, p.y - 40 * p.scale - 10, 40, 5);
        ctx.fillStyle = p.isPlayer ? '#22d3ee' : '#f87171';
        ctx.fillRect(p.x - 20, p.y - 40 * p.scale - 10, 40 * (p.lives / 2), 5);
    }
    
    // Draw floating texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px monospace';
    for (const ft of game.floatingTexts) {
        ctx.globalAlpha = Math.max(0, Math.min(1, ft.life)); // life is from 2.0 to 0.0, clamp to 1.0
        
        ctx.fillStyle = ft.color;
        
        // Pop up animation effect using life
        // life starts at 2.0. From 2.0 to 1.8, it scales up.
        ctx.save();
        ctx.translate(ft.x, ft.y);
        
        let scale = 1;
        if (ft.life > 1.8) {
            // scale from 0.5 to 1.0
            scale = 0.5 + (2.0 - ft.life) / 0.2 * 0.5;
        } else if (ft.life > 1.6) {
            // scale back to 1.0 (slight bounce)
            scale = 1.0 + (ft.life - 1.6) / 0.2 * 0.2; 
        }
        
        ctx.scale(scale, scale);
        
        // Text shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText(ft.text, 0, 0);
        ctx.restore();
    }
    ctx.globalAlpha = 1.0;
}

function drawPistolShape(ctx: CanvasRenderingContext2D, isPlayer: boolean, isShadow: boolean) {
    const mainColor = isPlayer ? '#22d3ee' : '#f87171';
    
    // Barrel
    ctx.fillStyle = isShadow ? '#0f172a' : '#475569';
    ctx.beginPath();
    ctx.roundRect(-10, -12, 55, 18, 4);
    ctx.fill();
    
    if (!isShadow) {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-6, -12, 49, 5);
    }
    
    // Grip
    ctx.save();
    ctx.translate(2, 6);
    ctx.rotate(Math.PI / 10); 
    ctx.fillStyle = isShadow ? '#020617' : '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-12, 0, 20, 35, 3);
    ctx.fill();
    
    if (!isShadow) {
        ctx.fillStyle = mainColor; // custom identification stripe
        ctx.fillRect(-7, 5, 8, 25);
    }
    ctx.restore();
    
    // Trigger Guard
    ctx.strokeStyle = isShadow ? '#020617' : '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(10, 8, 8, 0, Math.PI);
    ctx.stroke();

    // Trigger
    ctx.fillStyle = isShadow ? '#020617' : '#94a3b8';
    ctx.fillRect(7, 4, 3, 6);
}
