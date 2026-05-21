/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState } from './types';
import { AudioEngine } from './audio';
import { updateGameState, drawGame, initWave, shootWeapon } from './gameLogic';
import { Play, RotateCcw, Pause, Monitor, Smartphone } from 'lucide-react';

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobileDevice] = useState(() => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    });
    const [isPortrait, setIsPortrait] = useState(isMobileDevice);
    const audioRef = useRef<AudioEngine | null>(null);
    
    const gameRef = useRef<GameState>({
        pistols: [],
        bullets: [],
        particles: [],
        floatingTexts: [],
        score: 0,
        state: 'START',
        waveTransitioning: false,
        slowmoTime: 0
    });
    
    const [hud, setHud] = useState({ lives: 2, score: 0 });
    const [highscore, setHighscore] = useState(() => {
        const saved = localStorage.getItem('duel-highscore');
        return saved ? parseInt(saved, 10) : 0;
    });
    
    useEffect(() => {
        if (hud.score > highscore) {
            setHighscore(hud.score);
            localStorage.setItem('duel-highscore', hud.score.toString());
        }
    }, [hud.score, highscore]);
    
    const [, forceRender] = useState({});

    const togglePause = useCallback(() => {
        if (gameRef.current.state === 'PLAYING') {
            gameRef.current.state = 'PAUSED';
            if (audioRef.current) audioRef.current.stopBGM();
            forceRender({});
        } else if (gameRef.current.state === 'PAUSED') {
            gameRef.current.state = 'PLAYING';
            if (audioRef.current) audioRef.current.startBGM();
            forceRender({});
        }
    }, []);

    const tryShoot = useCallback(() => {
        if (gameRef.current.state === 'PLAYING') {
            const player = gameRef.current.pistols.find(p => p.isPlayer);
            if (player && player.lives > 0 && audioRef.current) {
                shootWeapon(player, gameRef.current, audioRef.current);
            }
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                tryShoot();
            } else if (e.code === 'Escape') {
                e.preventDefault();
                togglePause();
            } else if (e.code === 'Digit1' && e.getModifierState('CapsLock')) {
                e.preventDefault();
                if (!isMobileDevice) setIsPortrait(p => !p);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tryShoot, isMobileDevice]);

    const startGame = () => {
        if (!audioRef.current) audioRef.current = new AudioEngine();
        audioRef.current.startBGM();
        
        gameRef.current.state = 'PLAYING';
        gameRef.current.score = 0;
        const width = containerRef.current?.offsetWidth || window.innerWidth;
        const height = containerRef.current?.offsetHeight || window.innerHeight;
        
        initWave(gameRef.current, true, width, height);
        setHud({ lives: 2, score: 0 });
        forceRender({}); 
    };

    useEffect(() => {
        let requestId = 0;
        
        const loop = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container && (gameRef.current.state === 'PLAYING' || gameRef.current.state === 'PAUSED')) {
                if (canvas.width !== container.offsetWidth || canvas.height !== container.offsetHeight) {
                    canvas.width = container.offsetWidth;
                    canvas.height = container.offsetHeight;
                }
                
                const ctx = canvas.getContext('2d')!;
                if (gameRef.current.state === 'PLAYING') {
                    updateGameState(gameRef.current, audioRef.current!, canvas.width, canvas.height, (newState) => {
                        setHud(newState);
                        if (gameRef.current.state === 'GAME_OVER') {
                            forceRender({});
                        }
                    });
                }
                drawGame(ctx, gameRef.current, canvas.width, canvas.height);
            }
            requestId = requestAnimationFrame(loop);
        };
        
        requestId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestId);
    }, []);

    const state = gameRef.current.state;

    return (
        <div className="w-full h-screen bg-[#050505] flex items-center justify-center">
            <div 
                ref={containerRef}
                className={`relative overflow-hidden bg-[#0a0a0a] transition-all duration-500 ${isPortrait ? 'w-full sm:w-[400px] h-full sm:h-[800px] sm:max-h-[95vh] sm:rounded-2xl sm:border border-neutral-800 sm:shadow-cyan-900/20 sm:shadow-[0_0_50px]' : 'w-full h-full'}`}
            >
                <div 
                    className="w-full h-full text-white font-sans relative select-none cursor-crosshair flex flex-col"
                    onPointerDown={tryShoot}
                >
            {/* Background / Arena Layer */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#262626_0%,#0a0a0a_100%)] pointer-events-none">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
                <div className="absolute bottom-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neutral-600 to-transparent"></div>
            </div>

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />
            
            {/* Vibe/Atmosphere Overlay */}
            <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black to-transparent opacity-60"></div>
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent opacity-60"></div>
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" }}></div>
            </div>

            {(state === 'PLAYING' || state === 'PAUSED') && (
                <div className="absolute inset-0 p-4 sm:p-8 flex flex-col justify-between pointer-events-none z-10 text-white font-sans">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 sm:gap-4 bg-neutral-900/80 border border-neutral-700 px-3 sm:px-4 py-2 rounded-lg backdrop-blur-sm">
                                <span className="text-[8px] sm:text-xs font-bold tracking-widest text-neutral-400 uppercase">Pemain</span>
                                <div className="flex gap-1 sm:gap-2">
                                    {[...Array(2)].map((_, i) => (
                                        <div key={i} className={`w-4 sm:w-8 h-1.5 sm:h-3 rounded-sm ${i < hud.lives ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-neutral-700'}`}></div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col bg-neutral-900/80 border border-neutral-700 px-2 sm:px-4 py-1 sm:py-2 rounded-lg backdrop-blur-sm">
                                <div className="text-[10px] sm:text-sm text-cyan-400 font-mono tracking-tighter block whitespace-nowrap">SKOR: {hud.score.toString()}</div>
                                <div className="text-[8px] sm:text-xs text-neutral-500 font-mono tracking-widest block whitespace-nowrap">TERTINGGI:  {highscore.toString()}</div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 sm:gap-2">
                            <div className="flex items-center gap-2 sm:gap-4 bg-neutral-900/80 border border-neutral-700 px-2 sm:px-4 py-1 sm:py-2 rounded-lg backdrop-blur-sm pointer-events-auto cursor-pointer hover:bg-neutral-800 transition-colors" onPointerDown={(e) => { e.stopPropagation(); togglePause(); }}>
                                <Pause size={14} className="text-neutral-400 sm:w-4 sm:h-4 w-3 h-3" />
                                <span className="text-[8px] sm:text-xs font-bold tracking-widest text-neutral-400 uppercase">JEDA [ESC]</span>
                            </div>
                            
                            {!isMobileDevice && (
                                <div className="flex items-center gap-2 sm:gap-4 bg-neutral-900/80 border border-neutral-700 px-2 sm:px-4 py-1 sm:py-2 rounded-lg backdrop-blur-sm pointer-events-auto cursor-pointer hover:bg-neutral-800 transition-colors" onPointerDown={(e) => { e.stopPropagation(); setIsPortrait(p => !p); }}>
                                    {isPortrait ? <Monitor size={14} className="text-cyan-400 sm:w-4 sm:h-4 w-3 h-3" /> : <Smartphone size={14} className="text-neutral-400 sm:w-4 sm:h-4 w-3 h-3" />}
                                    <span className="text-[8px] sm:text-xs font-bold tracking-widest text-neutral-400 uppercase">MODE [CAPSLOCK+1]</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isMobileDevice && (
                        <div className="flex justify-center items-end">
                            <div className="bg-neutral-900/80 border border-neutral-700 p-4 rounded-xl flex items-center gap-8 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 border-2 border-neutral-600 rounded-lg flex items-center justify-center font-bold text-neutral-400">SPC</div>
                                    <span className="text-xs text-neutral-400 uppercase tracking-widest font-bold">Tembak</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {state === 'PAUSED' && (
                <div className="absolute inset-0 bg-neutral-950/60 flex flex-col items-center justify-center z-20 backdrop-blur-sm px-4">
                    <h2 className="text-4xl md:text-6xl font-black text-white italic mb-8 tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">JEDA</h2>
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); togglePause(); }}
                        className="px-6 md:px-8 py-3 md:py-4 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-xl text-lg md:text-xl flex items-center gap-3 active:scale-95 transition-transform shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                    >
                        <Play fill="currentColor" size={24} />
                        LANJUTKAN
                    </button>
                </div>
            )}

            {state === 'START' && (
                <div className="absolute inset-0 bg-neutral-950/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm px-4">
                    <div className="mb-4">
                        <h1 className="text-5xl md:text-6xl font-black text-white italic tracking-tighter text-center">DUEL</h1>
                        <h1 className="text-5xl md:text-6xl font-black text-cyan-400 italic tracking-tighter text-center drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">PISTOL</h1>
                    </div>
                    <p className="text-neutral-400 mb-8 max-w-sm text-center font-mono text-xs md:text-sm leading-relaxed">
                        Ketuk di mana saja atau tekan SPASI untuk menembak! Hancurkan bot, gunakan hentakan senjata untuk tetap melayang, dan jangan sampai tertembak!
                    </p>
                    {highscore > 0 && (
                        <div className="mb-6 text-cyan-400/60 font-mono border border-cyan-900/30 bg-cyan-950/20 px-4 py-2 rounded-lg backdrop-blur-md text-sm md:text-base">
                            SKOR TERTINGGI: <span className="font-bold text-cyan-300">{highscore.toString()}</span>
                        </div>
                    )}
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
                        className="px-6 md:px-8 py-3 md:py-4 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-xl text-lg md:text-xl flex items-center gap-3 active:scale-95 transition-transform shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]"
                    >
                        <Play fill="currentColor" size={24} />
                        MULAI MAIN
                    </button>
                </div>
            )}

            {state === 'GAME_OVER' && (
                <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center z-20 backdrop-blur-md px-4">
                    <h2 className="text-4xl md:text-6xl font-black text-white italic mb-2 tracking-tight drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">GAME OVER</h2>
                    <p className="text-red-200 text-lg md:text-xl font-mono mb-2 font-bold tracking-widest">SKOR AKHIR: {hud.score.toString()}</p>
                    {hud.score >= highscore && hud.score > 0 && (
                        <p className="text-yellow-400 text-md font-mono mb-8 font-black tracking-widest animate-pulse">SKOR TERTINGGI BARU!</p>
                    )}
                    {hud.score < highscore && (
                        <p className="text-red-300/60 text-sm font-mono mb-8 tracking-widest">SKOR TERTINGGI: {highscore.toString()}</p>
                    )}
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
                        className="px-8 py-4 bg-white hover:bg-neutral-200 text-red-900 font-bold rounded-xl text-xl flex items-center gap-3 active:scale-95 transition-transform"
                    >
                        <RotateCcw size={24} />
                        COBA LAGI
                    </button>
                </div>
            )}
            
            {gameRef.current.waveTransitioning && state === 'PLAYING' && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 animate-pulse">
                     <div className="bg-neutral-900/80 border border-neutral-700 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                         <h2 className="text-3xl font-black text-cyan-400 italic tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">GELOMBANG BERIKUTNYA</h2>
                     </div>
                </div>
            )}
                </div>
            </div>
        </div>
    );
}
