"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Bell, Play, Square, RotateCcw, Settings, Shuffle } from 'lucide-react';


// インターフェースを定義
type SokuShuchuProps = object

const SokuShuchu: React.FC<SokuShuchuProps> = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false); // タイマーが一度でも開始されたか
  // minutes/seconds は実際に経過した時間（0からスタート）
  const [minutes, setMinutes] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [cycles, setCycles] = useState<number>(0);
  const [showCycles, setShowCycles] = useState<boolean>(false); // 「周回数を表示」のトグル
  const [timerInterval, setTimerInterval] = useState<number>(12);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(false);
  const [showElapsedTime, setShowElapsedTime] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [alarmPlaying, setAlarmPlaying] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const randomOffsetMinutesRef = useRef<number>(0);
  const randomOffsetSecondsRef = useRef<number>(0);
  const appInBackgroundTimeRef = useRef<number | null>(null);

  // Initialize audio for alarm
  useEffect(() => {
    audioRef.current = new Audio("/zen-bell.wav");
  }, []);

  // Main timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      interval = setInterval(() => {
        // 実際の経過時間 (minutes, seconds) を更新
        setSeconds((prevActualSeconds: number) => {
          const newActualSeconds = prevActualSeconds + 1;
          if (newActualSeconds === 60) {
            setMinutes((prevActualMinutes: number) => {
              const newActualMinutes = prevActualMinutes + 1;
              // 周回数カウント (1分ごとにカウントアップ)
              if (newActualMinutes !== 0) { // 最初の0分時はカウントしない
                setCycles((prevCycles: number) => prevCycles + 1);
              }
              // アラームロジック: timerInterval に基づいて鳴らす
              if (timerEnabled && newActualMinutes !== 0 && newActualMinutes % timerInterval === 0) {
                playAlarm();
              }
              return newActualMinutes;
            });
            return 0; // Reset actualSeconds to 0
          }
          return newActualSeconds;
        });
        // sessionMinutes/Seconds の更新は不要になったので削除
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timerEnabled, timerInterval, minutes]); // minutes を依存配列に追加（cycles更新のため）

  const playAlarm = useCallback((): void => {
    if (audioRef.current) {
      setAlarmPlaying(true);
      audioRef.current.play();

      audioRef.current.onended = () => {
        setAlarmPlaying(false);
      };
    }
  }, [audioRef, setAlarmPlaying]);

  // App state change listener for background/foreground handling
  useEffect(() => {
    let listenerHandle: import('@capacitor/core').PluginListenerHandle | null = null;

    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener('appStateChange', (state: { isActive: boolean }) => {
        if (!state.isActive) {
          // App is going to background
          if (isRunning) {
            appInBackgroundTimeRef.current = Date.now();
            // Optionally, you might want to clear the interval here if isRunning is managed by this state
            // For now, we assume the main interval continues or is paused by OS
          }
        } else {
          // App is coming to foreground
          if (appInBackgroundTimeRef.current && isRunning) {
            const timeInBackground = Date.now() - appInBackgroundTimeRef.current;
            const secondsInBackground = Math.floor(timeInBackground / 1000);
            appInBackgroundTimeRef.current = null;

            // Adjust timer based on time spent in background
            setSeconds(prevSeconds => {
              const newTotalSeconds = minutes * 60 + prevSeconds + secondsInBackground;
              const newMinutes = Math.floor(newTotalSeconds / 60);
              const newRemainingSeconds = newTotalSeconds % 60;

              setMinutes(newMinutes);
              // Potentially re-calculate cycles and trigger alarm if needed based on newMinutes
              // This part needs careful integration with existing cycle and alarm logic
              if (timerEnabled) {
                // Check if alarm should have sounded while in background
                const oldTotalMinutes = minutes; // Before adding background time
                const currentTotalMinutes = newMinutes;
                for (let m = oldTotalMinutes + 1; m <= currentTotalMinutes; m++) {
                  if (m % timerInterval === 0) {
                    playAlarm(); // Now playAlarm is defined before this useEffect
                    break; // Play alarm once if multiple intervals passed
                  }
                }
              }
              // Update cycles based on the new total minutes
              // This logic assumes cycles increment per minute. Adjust if different.
              const minutesPassed = newMinutes - minutes; // minutes here is the value before setMinutes(newMinutes)
              if (minutesPassed > 0) {
                   setCycles(prevCycles => prevCycles + minutesPassed);
              }

              return newRemainingSeconds;
            });
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [isRunning, timerEnabled, timerInterval, playAlarm, minutes, seconds]);

  // Clock drawing
// Enhanced Clock drawing with modern design
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 300; // 少し小さくしてスタイリッシュに
    const displayHeight = 300;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    ctx.scale(dpr, dpr);

    const radius = Math.min(displayWidth, displayHeight) / 2 * 0.9; // 枠を細くするため少し大きく
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw clock face (シンプルに)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8fafc'; // 明るいグレー（ほぼ白）
    ctx.fill();

    // Draw clock border (細くシャープに)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 2; // 細い線
    ctx.strokeStyle = '#e2e8f0'; // 薄いグレー
    ctx.stroke();
    
    // Draw hour marks
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI / 6) - (Math.PI / 2);
      const isMainHour = i % 3 === 0;
      const markLength = isMainHour ? radius * 0.1 : radius * 0.05;
      const markWidth = isMainHour ? 2.5 : 1.5;
      
      ctx.beginPath();
      ctx.lineWidth = markWidth;
      ctx.strokeStyle = '#475569'; // 濃いグレー
      ctx.moveTo(
        centerX + (radius - markLength) * Math.cos(angle),
        centerY + (radius - markLength) * Math.sin(angle)
      );
      ctx.lineTo(
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle)
      );
      ctx.stroke();
    }

    // Draw minute marks
    for (let i = 0; i < 60; i++) {
      if (i % 5 !== 0) { // Avoid drawing over hour marks
        const angle = (i * Math.PI / 30) - (Math.PI / 2);
        const markLength = radius * 0.03;
        
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#94a3b8'; // やや薄いグレー
        ctx.moveTo(
          centerX + (radius - markLength) * Math.cos(angle),
          centerY + (radius - markLength) * Math.sin(angle)
        );
        ctx.lineTo(
          centerX + radius * Math.cos(angle),
          centerY + radius * Math.sin(angle)
        );
        ctx.stroke();
      }
    }

    // Draw numbers
    ctx.font = `normal ${radius * 0.15}px system-ui, -apple-system, sans-serif`; // "bold" を削除、少し小さく
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1e293b'; // 濃いグレー（ほぼ黒）
    
    for (let num = 1; num <= 12; num++) {
      const angle = (num * Math.PI / 6) - (Math.PI / 2);
      // 数字の位置をマークの内側に調整
      const x = centerX + radius * 0.78 * Math.cos(angle);
      const y = centerY + radius * 0.78 * Math.sin(angle);
      ctx.fillText(num.toString(), x, y);
    }
    
    const currentDisplaySeconds = (randomOffsetSecondsRef.current + seconds) % 60;
    const carryOverMinutes = Math.floor((randomOffsetSecondsRef.current + seconds) / 60);
    const currentDisplayMinutes = (randomOffsetMinutesRef.current + minutes + carryOverMinutes) % 60;

    const minuteAngle = ((currentDisplayMinutes % 12) * 30 + currentDisplaySeconds * 0.5) * Math.PI / 180 - Math.PI / 2; // 12分計になるように角度計算を修正
    const secondAngle = (currentDisplaySeconds * 6) * Math.PI / 180 - Math.PI / 2;

    // Draw minute hand (シャープに)
    ctx.beginPath();
    ctx.lineWidth = 4; // 少し細く
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e40af'; // 青系 (現状維持)
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + radius * 0.65 * Math.cos(minuteAngle), // 長さを調整
      centerY + radius * 0.65 * Math.sin(minuteAngle)
    );
    ctx.stroke();
    
    // Draw second hand (シャープに)
    ctx.beginPath();
    ctx.lineWidth = 2; // 細く
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#dc2626'; // 赤系 (現状維持)
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + radius * 0.8 * Math.cos(secondAngle), // 長さを調整
      centerY + radius * 0.8 * Math.sin(secondAngle)
    );
    ctx.stroke();
    
    // Draw center dot (シンプルに)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.05, 0, 2 * Math.PI); // サイズ調整
    ctx.fillStyle = '#1e293b'; // 針と同じ濃いグレー
    ctx.fill();

  }, [seconds, minutes, timerEnabled, timerInterval]);
  
  const stopAlarm = (): void => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAlarmPlaying(false);
    }
  };

  const toggleTimer = (): void => { // 「一時停止」「再開」のトグル専用にする
    setIsRunning(!isRunning);
  };

  const handleStart = () => {
    setMinutes(0);
    setSeconds(0);
    setCycles(0);
    randomOffsetMinutesRef.current = 0;
    randomOffsetSecondsRef.current = 0;
    setHasStarted(true);
    setIsRunning(true);
  };

  const handleRandomStart = () => {
    setMinutes(0);
    setSeconds(0);
    setCycles(0);
    randomOffsetMinutesRef.current = Math.floor(Math.random() * 12);
    randomOffsetSecondsRef.current = Math.floor(Math.random() * 60);
    setHasStarted(true);
    setIsRunning(true);
  };
  
  const resetClock = (): void => { // 「リセット」ボタンの機能
    setMinutes(0);
    setSeconds(0);
    setCycles(0);
    randomOffsetMinutesRef.current = 0;
    randomOffsetSecondsRef.current = 0;
    setIsRunning(false);
    setHasStarted(false); // 未開始状態に戻す
  };

  const toggleSettings = (): void => {
    setShowSettings(!showSettings);
  };

  return (
    <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4 ${showSettings ? 'min-h-screen overflow-y-auto overflow-x-hidden' : 'h-screen overflow-y-hidden overflow-x-hidden'}`}>
      {/* Enhanced Header */}
      <div className="text-center mb-8 pt-12">
        <h1 className="text-4xl text-blue-600 mb-2">
          Sauna12timer
        </h1>
        <div className="w-16 h-1 bg-blue-500 rounded-full mx-auto"></div>
      </div>
      
      {/* Enhanced Clock Container */}
      <div className="relative mb-8 p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-blue-50/80 rounded-full blur-xl"></div>
        <div className="relative bg-white/90 backdrop-blur-sm rounded-full p-6 shadow-2xl border border-white/50">
          <canvas 
            ref={canvasRef}
            className="drop-shadow-lg"
          />
          
          {alarmPlaying && (
            <button 
              onClick={stopAlarm}
              className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white p-3 rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform duration-200 animate-pulse"
            >
              <Bell size={24} className="animate-bounce" />
            </button>
          )}
        </div>
      </div>
      
      {/* Enhanced Time Display */}
      {showElapsedTime && (
        <div className="mb-8 text-center bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-lg border border-white/50">
          <p className="text-slate-600 text-sm font-medium mb-1">経過時間</p>
          <p className="text-5xl font-normal font-mono text-slate-800">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
        </div>
      )}
      
      {/* Enhanced Controls */}
      <div className="flex flex-col items-center mt-4 w-full max-w-sm space-y-4 px-4">
        {/* Main Control Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full">
          {!hasStarted ? (
            <>
              <button
                onClick={handleStart}
                className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-bold shadow-lg bg-emerald-500 hover:bg-emerald-600 transform hover:scale-105 transition-all duration-200"
              >
                <Play size={20} />
                スタート
              </button>
              <button
                onClick={handleRandomStart}
                className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-bold shadow-lg bg-purple-500 hover:bg-purple-600 transform hover:scale-105 transition-all duration-200"
              >
                <Shuffle size={20} />
                ランダム
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleTimer}
                className={`flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-bold shadow-lg transform hover:scale-105 transition-all duration-200 ${
                  isRunning
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isRunning ? <Square size={20} /> : <Play size={20} />}
                {isRunning ? '一時停止' : '再開'}
              </button>
              <button
                onClick={resetClock}
                className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-bold shadow-lg bg-slate-500 hover:bg-slate-600 transform hover:scale-105 transition-all duration-200"
              >
                <RotateCcw size={20} />
                リセット
              </button>
            </>
          )}
        </div>
        
        {/* Cycles Display */}
        {showCycles && (
          <div className="bg-blue-50 rounded-2xl shadow-lg p-6 w-full text-center border border-blue-100">
            <p className="text-slate-600 font-medium mb-1">完了した周回数</p>
            <p className="text-3xl font-bold text-blue-600">
              {cycles} 周目
            </p>
          </div>
        )}
        
        {/* Settings Button */}
        <button
          onClick={toggleSettings}
          className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-2xl text-slate-700 font-medium shadow-lg bg-white/80 backdrop-blur-sm hover:bg-white/90 border border-white/50 transform hover:scale-105 transition-all duration-200"
        >
          <Settings size={20} />
          {showSettings ? '設定を閉じる' : '設定を開く'}
        </button>
        
        {/* Enhanced Settings Panel */}
        {showSettings && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full border border-white/50 space-y-6">
            {/* Toggle Settings */}
            {[
              { label: '経過時間を表示', state: showElapsedTime, setter: setShowElapsedTime },
              { label: '周回数を表示', state: showCycles, setter: setShowCycles },
              { label: 'タイマーを有効化', state: timerEnabled, setter: setTimerEnabled }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">{item.label}</span>
                <div 
                  onClick={() => item.setter(!item.state)}
                  className={`relative inline-block w-14 h-7 transition-colors duration-300 ease-in-out rounded-full cursor-pointer ${
                    item.state ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 bg-white w-5 h-5 transition-transform duration-300 ease-in-out rounded-full shadow-md transform ${
                      item.state ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            ))}
            
            {/* Timer Interval Slider */}
            {timerEnabled && (
              <div className="space-y-3">
                <label className="block text-slate-700 font-medium">
                  タイマー間隔: {timerInterval} 分
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={timerInterval}
                    onChange={(e) => setTimerInterval(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(timerInterval / 60) * 100}%, #cbd5e1 ${(timerInterval / 60) * 100}%, #cbd5e1 100%)`
                    }}
                  />
                </div>
              </div>
            )}
            
            <div className="text-xs text-slate-500 mt-4 p-3 bg-slate-50 rounded-lg">
              <p>※ タイマーは設定した分数が経過すると音が鳴ります</p>
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          cursor: pointer;
        }
        
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default SokuShuchu;