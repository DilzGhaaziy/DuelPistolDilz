export interface Pistol {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    vAngle: number;
    lives: number;
    isPlayer: boolean;
    scale: number;
    cooldown: number;
    timeNotFacingPlayer?: number;
}
export interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: number;
    dead?: boolean;
    nearMissMarked?: boolean;
    history: {x: number, y: number}[];
}
export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}
export interface FloatingText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
}
export interface GameState {
    pistols: Pistol[];
    bullets: Bullet[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    score: number;
    state: 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
    waveTransitioning: boolean;
    slowmoTime: number;
    wasSlowmo?: boolean;
}
