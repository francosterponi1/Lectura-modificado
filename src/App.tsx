/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Settings2, Info, Activity, Mic, MicOff, Trophy } from 'lucide-react';
import { WORDS, WordEntry } from './constants';

// --- Auto-scaling Component ---
function ResponsiveWord({ word, isMobile }: { word: string; isMobile: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(10);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === 0 || height === 0) return;

      const targetWidth = width * 0.95; 
      const targetHeight = height * 0.85;

      // Aggressive scaling logic
      // We assume a character is roughly 0.6x its height in width for font-black
      const charFactor = 0.6; 
      const sizeW = targetWidth / (word.length * charFactor);
      const sizeH = targetHeight;

      setFontSize(Math.min(sizeW, sizeH));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure(); // Initial

    return () => observer.disconnect();
  }, [word]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={word}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1, ease: "linear" }}
          className="w-full h-full flex flex-col items-center justify-center text-center"
        >
          <div className="flex flex-col items-center justify-center w-full select-none px-4">
            <span className={`block font-mono text-[10px] uppercase opacity-40 ${isMobile ? 'mb-1' : 'mb-4'} tracking-[0.4em] leading-none transition-all duration-300`}>
              Palabra Actual
            </span>
            <h1
              style={{ fontSize: `${fontSize}px` }}
              className="font-black uppercase tracking-tighter text-center leading-[0.8] whitespace-nowrap"
            >
              {word}
            </h1>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const [currentWord, setCurrentWord] = useState<WordEntry | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(4.5); // matching design html default
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isActualListening, setIsActualListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  
  const requestRef = useRef<number>(null);
  const startTimeRef = useRef<number>(null);
  const lastWordRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentWordRef = useRef<string | null>(null);

  // Device and Orientation Detection
  useEffect(() => {
    const checkDevice = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.matchMedia("(max-width: 1024px) and (pointer: coarse)").matches);
      setIsMobile(mobile);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Sync ref for speech recognition access without re-starting service
  useEffect(() => {
    currentWordRef.current = currentWord?.word || null;
  }, [currentWord]);

  const getNextWord = useCallback(() => {
    const availableWords = WORDS.filter(w => w.word !== lastWordRef.current);
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    const selected = availableWords[randomIndex];
    lastWordRef.current = selected.word;
    return selected;
  }, []);

  const handleNext = useCallback(() => {
    setCurrentWord(getNextWord());
    startTimeRef.current = performance.now();
    setProgress(0);
  }, [getNextWord]);

  // Speech Recognition Logic
  useEffect(() => {
    let recognition: any = null;

    if (isMicEnabled && isPlaying) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMicError("Navegador no compatible");
        setIsMicEnabled(false);
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsActualListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        
        const cleanTranscript = transcript.toLowerCase().trim();
        setLastTranscript(cleanTranscript);
        
        const targetWord = currentWordRef.current?.toLowerCase().trim();
        
        if (targetWord && cleanTranscript.includes(targetWord)) {
          setScore(s => s + 1);
          setLastTranscript(""); // Limpiar para la siguiente palabra
          handleNext();
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsActualListening(false);
        if (event.error === 'not-allowed') {
          setMicError("Acceso denegado");
          setIsMicEnabled(false);
        } else if (event.error === 'no-speech') {
          // Restart normally on silent interval
        } else {
          setMicError(event.error);
        }
      };

      recognition.onend = () => {
        setIsActualListening(false);
        if (isMicEnabled && isPlaying) {
          try {
            recognition.start();
          } catch(e) {
            console.error(e);
          }
        }
      };

      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }

    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        try {
          recognition.stop();
        } catch (e) {
          // Ignore
        }
      }
      setIsActualListening(false);
    };
  }, [isMicEnabled, isPlaying, handleNext]);

  const animate = useCallback((time: number) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = time;
    }

    const elapsed = (time - startTimeRef.current) / 1000;
    const currentProgress = Math.min(elapsed / duration, 1);
    setProgress(currentProgress);

    if (currentProgress >= 1) {
      handleNext();
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [duration, handleNext]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      startTimeRef.current = null;
      setProgress(0);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  const handleToggle = () => {
    const nextPlaying = !isPlaying;
    if (!isPlaying) {
      setCurrentWord(getNextWord());
      setScore(0);
    }
    setIsPlaying(nextPlaying);
  };

  return (
    <div className={`flex flex-col h-screen max-h-screen relative bg-bg selection:bg-text selection:text-bg border-[#1A1A1A] ${isMobile ? 'landscape:overflow-hidden' : ''}`}>
      {/* Mobile Orientation Overlay */}
      <AnimatePresence>
        {isMobile && isPortrait && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg z-[200] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ repeat: Infinity, duration: 2, times: [0, 0.4, 0.6, 1] }}
              className="w-16 h-16 border-4 border-text rounded-lg mb-8 flex items-center justify-center"
            >
              <div className="w-8 h-1 bg-text rounded-full" />
            </motion.div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tighter mb-4">Gira tu dispositivo</h2>
            <p className="font-mono text-[10px] opacity-60 uppercase tracking-widest leading-relaxed max-w-xs">
              P.A.Z. Edición Niños requiere el modo horizontal para una mejor experiencia de lectura.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Absolute center marks (Architectural Accent) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-24 bg-text z-50 pointer-events-none opacity-20 md:opacity-100" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-24 bg-text z-50 pointer-events-none opacity-20 md:opacity-100" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-24 h-px bg-text z-50 pointer-events-none opacity-20 md:opacity-100" />
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-px bg-text z-50 pointer-events-none opacity-20 md:opacity-100" />

      {/* Header */}
      <header className={`${isMobile ? 'px-6 py-2' : 'px-12 py-8'} flex items-center justify-between border-b border-text/10 relative z-10 transition-all duration-300`}>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex flex-col">
            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold tracking-tighter uppercase mb-[-4px]`}>P.A.Z. Edición Niños</span>
            <span className={`${isMobile ? 'hidden' : 'block'} text-[10px] font-mono opacity-50 uppercase tracking-widest`}>VER_M_2.4.0</span>
          </div>

          <AnimatePresence>
            {score > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center ${isMobile ? 'gap-2 px-4 py-2' : 'gap-4 px-8 py-5'} bg-text text-bg rounded-xl shadow-2xl border-2 border-white/20`}
              >
                <Trophy size={isMobile ? 18 : 32} className="text-yellow-400 fill-yellow-400/20" />
                <span className={`font-mono ${isMobile ? 'text-lg' : 'text-3xl'} font-black leading-none tracking-tighter`}>SCORE: {score}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          {isMicEnabled && isActualListening && (
            <motion.div 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="flex items-center gap-2 px-3 py-1 border border-green-500/20 rounded-full"
            >
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-green-600 hidden md:inline">Escuchando...</span>
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 animate-pulse'} transition-colors duration-500`} />
            <span className="font-mono text-[11px] uppercase tracking-widest opacity-80 hidden md:inline">
              Estado: {isPlaying ? "Operativo" : "Inactivo"}
            </span>
          </div>
          <div className="w-px h-4 bg-text opacity-20 hidden md:block" />
          <span className="font-mono text-[11px] uppercase opacity-50 tracking-widest">
            {isMobile ? currentWord?.category?.slice(0, 3) : `Cat: ${currentWord?.category || "---"}`}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-0 relative overflow-hidden">
        {currentWord ? (
          <div className="flex-1 w-full flex flex-col items-center justify-center relative overflow-hidden">
            <ResponsiveWord word={currentWord.word} isMobile={isMobile} />
            <AnimatePresence>
              {isMicEnabled && isActualListening && lastTranscript && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 0.3, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`absolute ${isMobile ? 'bottom-2 text-[10px]' : 'bottom-12 text-xs'} font-mono uppercase tracking-widest italic z-20`}
                >
                  "{lastTranscript}"
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <motion.p
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className={`font-display ${isMobile ? 'text-2xl' : 'text-4xl'} font-black opacity-30 text-center uppercase tracking-tighter`}
            >
              Presiona comenzar para iniciar
            </motion.p>
          </div>
        )}

        {/* Progress Bar Container */}
        <div className={`w-full max-w-4xl mx-auto ${isMobile ? 'pb-2 px-6' : 'pb-16'}`}>
          <div className={`${isMobile ? 'h-4' : 'h-8'} w-full bg-black/5 border-2 border-text relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]`}>
            <div
              className="h-full absolute left-0 top-0 transition-[width] duration-75 linear"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(to right, #4ade80, #facc15, #f87171)`,
              }}
            />
          </div>
          <div className={`flex justify-between mt-2 font-mono text-[9px] uppercase tracking-widest opacity-60 ${isMobile ? 'hidden md:flex' : 'flex'}`}>
            <span>0.0s</span>
            {isPlaying && (
              <span className="animate-pulse">Transcurrido: {(duration * progress).toFixed(1)}s</span>
            )}
            <span>{duration.toFixed(1)}s</span>
          </div>
        </div>
      </main>

      {/* Footer / Controls */}
      <footer className={`${isMobile ? 'p-4' : 'p-12'} border-t border-text/10 bg-bg relative z-10 transition-all duration-300`}>
        <div className="max-w-5xl mx-auto grid grid-cols-12 md:gap-12 gap-4 items-end">
          
          {/* Slider Control */}
          <div className="col-span-12 md:col-span-7 flex flex-col">
            <div className={`flex justify-between items-end ${isMobile ? 'mb-1' : 'mb-4'}`}>
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-90">Intervalo</label>
              <span className={`font-mono ${isMobile ? 'text-sm' : 'text-lg'} font-bold`}>{duration.toFixed(1)}s</span>
            </div>
            
            <div className={`relative ${isMobile ? 'pt-2 pb-4' : 'pt-4 pb-12'}`}>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={duration}
                onChange={(e) => {
                  setDuration(parseFloat(e.target.value));
                  if (isPlaying) {
                    startTimeRef.current = performance.now();
                    setProgress(0);
                  }
                }}
                className="w-full"
                aria-label="Ajustar intervalo de tiempo"
              />
            </div>
            
            <div className={`flex justify-between font-mono text-[8px] opacity-40 uppercase tracking-widest ${isMobile ? 'hidden' : 'flex'}`}>
              <span>1.0S</span>
              <span>2.5S</span>
              <span>5.0S</span>
              <span>7.5S</span>
              <span>10.0S</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={`col-span-12 md:col-span-5 flex gap-4 ${isMobile ? 'h-12' : 'h-16'}`}>
            <button
              onClick={() => {
                setMicError(null);
                setIsMicEnabled(!isMicEnabled);
              }}
              className={`flex-none ${isMobile ? 'w-12' : 'w-16'} border-2 flex items-center justify-center transition-all relative ${
                isMicEnabled 
                ? (micError ? 'bg-red-100 border-red-500 text-red-500' : 'bg-green-500 text-bg border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]') 
                : 'bg-bg text-text/40 border-text/10 hover:border-text hover:text-text'
              }`}
              title={isMicEnabled ? "Desactivar Micrófono" : "Activar Micrófono"}
            >
              {isMicEnabled ? <Mic size={isMobile ? 18 : 20} /> : <MicOff size={isMobile ? 18 : 20} />}
              {micError && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-2 py-1 uppercase whitespace-nowrap">
                  {micError}
                </div>
              )}
            </button>
            <button
              onClick={handleToggle}
              className={`flex-1 border-2 border-text font-bold uppercase ${isMobile ? 'text-[10px]' : 'text-xs'} tracking-[0.2em] transition-all duration-200 active:scale-95 ${
                isPlaying 
                ? 'bg-text text-white hover:bg-bg hover:text-text' 
                : 'bg-bg text-text hover:bg-text hover:text-white'
              }`}
            >
              {isPlaying ? 'Detener' : 'Comenzar'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

