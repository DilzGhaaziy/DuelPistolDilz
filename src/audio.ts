export class AudioEngine {
    private ctx: AudioContext;
    private isPlaying = false;
    private bgmTimeout: any;
    
    private audios: Record<string, HTMLAudioElement> = {};

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.audios.shoot = new Audio('/pistol.mp3');
        this.audios.hit = new Audio('/hit.mp3');
        this.audios.death = new Audio('/death.mp3');
        this.audios.collide = new Audio('/bullet_collide.mp3');
        this.audios.slowmo = new Audio('/slowmo.mp3');

        Object.values(this.audios).forEach(a => a.preload = 'auto');
    }

    async loadAssets() {
        // No pre-loading decoding required for HTML5 Audio
    }

    private playSnd(name: string, vol: number = 1.0, rate: number = 1.0) {
        try {
            const a = this.audios[name].cloneNode(true) as HTMLAudioElement;
            a.volume = vol;
            a.playbackRate = rate;
            if ('preservesPitch' in a) (a as any).preservesPitch = false;
            a.play().catch(() => {});
        } catch (e) {
            console.error(e);
        }
    }

    startBGM() {
        if (this.isPlaying) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.isPlaying = true;
        let step = 0;
        
        const play = () => {
           if (!this.isPlaying) return;
           const t = this.ctx.currentTime;
           const notes = [
               55.00, 0, 55.00, 0, 65.41, 0, 55.00, 0, 
               49.00, 0, 49.00, 0, 73.42, 0, 82.41, 0
           ];
           const note = notes[step % 16];
           
           if (note > 0) {
               const osc = this.ctx.createOscillator();
               const gain = this.ctx.createGain();
               osc.type = 'sawtooth';
               osc.frequency.value = note;
               
               const filter = this.ctx.createBiquadFilter();
               filter.type = 'lowpass';
               filter.frequency.setValueAtTime(1500, t);
               filter.frequency.exponentialRampToValueAtTime(150, t + 0.15);
               
               osc.connect(filter);
               filter.connect(gain);
               gain.connect(this.ctx.destination);
               
               gain.gain.setValueAtTime(0.1, t);
               gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
               
               osc.start(t);
               osc.stop(t + 0.2);
           }
           
           if (step % 2 === 0) { // Kick drum
               const osc = this.ctx.createOscillator();
               const gain = this.ctx.createGain();
               osc.frequency.setValueAtTime(120, t);
               osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
               gain.gain.setValueAtTime(0.3, t);
               gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
               osc.connect(gain);
               gain.connect(this.ctx.destination);
               osc.start(t);
               osc.stop(t + 0.1);
           }
           
           step++;
           this.bgmTimeout = setTimeout(play, 130);
        };
        play();
    }

    stopBGM() {
        this.isPlaying = false;
        if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
    }

    playShoot(isPlayer: boolean) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const rate = isPlayer ? 1.0 + (Math.random() * 0.1 - 0.05) : 0.8 + (Math.random() * 0.1);
        const vol = isPlayer ? 0.7 : 0.4;
        this.playSnd('shoot', vol, rate);
    }

    playHit() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.playSnd('hit', 0.8);
    }

    playDeath() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.playSnd('death', 0.9);
    }

    playBulletCollision() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.playSnd('collide', 0.5);
    }

    playSlowmo(durationSecs: number) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // Since we can't easily change playback rate linearly over time for HTML5 audio
        // We just play it once at a rate that roughly fits the duration
        // Assuming slowmo.mp3 is ~2 seconds long optimally
        const rate = 2.0 / durationSecs;
        this.playSnd('slowmo', 0.6, rate > 0.1 ? rate : 1.0);
    }
}
