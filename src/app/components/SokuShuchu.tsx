"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Bell } from 'lucide-react';

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
  }, [isRunning, timerEnabled, timerInterval, playAlarm]); // Removed minutes from dependency array

  // Clock drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // デバイスピクセル比を取得
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 300; // CSSで指定する表示幅
    const displayHeight = 300; // CSSで指定する表示高さ

    // canvasの実際の描画サイズを高解像度に設定
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // CSSで表示サイズを指定
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // 描画コンテキストをスケーリング
    ctx.scale(dpr, dpr);

    const radius = Math.min(displayWidth, displayHeight) / 2 * 0.9;
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;

    // Clear canvas (スケーリング後のサイズでクリア)
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw clock face
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#f0f9ff';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    
    // Draw hour marks
    ctx.font = radius * 0.15 + 'px arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let num = 1; num <= 12; num++) {
      const angle = (num * Math.PI / 6) - (Math.PI / 2);
      const x = centerX + radius * 0.85 * Math.cos(angle);
      const y = centerY + radius * 0.85 * Math.sin(angle);
      ctx.fillStyle = '#000';
      ctx.fillText(num.toString(), x, y);
    }
    
    // Calculate display time including offset
    const currentDisplaySeconds = (randomOffsetSecondsRef.current + seconds) % 60;
    const carryOverMinutes = Math.floor((randomOffsetSecondsRef.current + seconds) / 60);
    const currentDisplayMinutes = (randomOffsetMinutesRef.current + minutes + carryOverMinutes) % 60;

    // Calculate angle for minutes and seconds based on display time
    const minuteAngle = ((currentDisplayMinutes % 12) * 30 + currentDisplaySeconds / 2) * Math.PI / 180;
    const secondAngle = (currentDisplaySeconds * 6) * Math.PI / 180;
    
    // Draw minute hand
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'blue'; // 分針の色を青に変更
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + radius * 0.6 * Math.sin(minuteAngle), // 分針の長さを変更
      centerY - radius * 0.6 * Math.cos(minuteAngle)  // 分針の長さを変更
    );
    ctx.stroke();
    
    // Draw second hand (simplified, without the water drop at the tip)
    ctx.beginPath();
    ctx.lineWidth = 5; // 秒針の太さを分針に合わせる
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#e11d48';
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + radius * 0.8 * Math.sin(secondAngle), // 秒針の長さを変更
      centerY - radius * 0.8 * Math.cos(secondAngle)  // 秒針の長さを変更
    );
    ctx.stroke();
    
    // Draw center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#000';
    ctx.fill();
  }, [seconds, minutes, timerEnabled, timerInterval]); // sessionMinutes/Seconds を削除
  
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-sky-50 p-4">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-gray-800">Sauna12timer</h1>
      </div>
      
      <div className="relative mb-4">
        <canvas 
          ref={canvasRef}
          // widthとheight属性はuseEffect内で動的に設定するため削除
          className="border-4 border-gray-300 rounded-full shadow-lg"
          // style属性もuseEffect内で設定するため、ここでは不要であれば削除
          // style={{ width: '300px', height: '300px' }} // 必要であれば残す
        />
        
        {alarmPlaying && (
          <button 
            onClick={stopAlarm}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-md flex items-center justify-center"
          >
            <Bell size={20} />
          </button>
        )}
      </div>
      
      {showElapsedTime && (
        <div className="mb-4 text-center">
          <p className="text-gray-600 text-sm">経過時間</p>
          <p className="text-4xl font-bold font-mono text-gray-800">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
        </div>
      )}
      
      <div className="flex flex-col items-center mt-4 w-full max-w-xs">
        {isRunning ? (
          <button
            onClick={toggleTimer}
            className={`w-full py-3 px-6 rounded-lg text-white font-bold shadow-md mb-4 bg-red-500 hover:bg-red-600`}
          >
            一時停止
          </button>
        ) : hasStarted ? (
          <button
            onClick={toggleTimer} // isRunningがfalseでhasStartedがtrueなら「再開」
            className={`w-full py-3 px-6 rounded-lg text-white font-bold shadow-md mb-4 bg-blue-500 hover:bg-blue-600`}
          >
            再開
          </button>
        ) : (
          <div className="flex w-full space-x-2 mb-4">
            <button
              onClick={handleStart}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-bold shadow-md bg-green-500 hover:bg-green-600`}
            >
              スタート
            </button>
            <button
              onClick={handleRandomStart}
              className="flex-1 py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold shadow-md"
            >
              ランダム
            </button>
          </div>
        )}
        
        {showCycles && (
          <div className="bg-white rounded-lg shadow-md p-4 w-full mb-4 text-center">
            <div>
              <p className="text-gray-600">完了した周回数:</p>
              <p className="text-2xl font-bold">
                {cycles} 周目
              </p>
            </div>
          </div>
        )}
        
        <div className="flex justify-between w-full mb-4">
          <button
            onClick={resetClock}
            className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg shadow-md w-full"
          >
            リセット
          </button>
        </div>
        
        <button
          onClick={toggleSettings}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg shadow-md"
        >
          {showSettings ? '設定を閉じる' : '設定を開く'}
        </button>
        
        {showSettings && (
          <div className="bg-white rounded-lg shadow-md p-4 w-full mt-4">
            <div className="mb-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">経過時間を表示:</span>
                <div 
                  onClick={() => setShowElapsedTime(!showElapsedTime)}
                  className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                    showElapsedTime ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 bg-white w-4 h-4 transition-transform duration-200 ease-in-out rounded-full transform ${
                      showElapsedTime ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">周回数を表示:</span>
                <div
                  onClick={() => setShowCycles(!showCycles)}
                  className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                    showCycles ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 bg-white w-4 h-4 transition-transform duration-200 ease-in-out rounded-full transform ${
                      showCycles ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">タイマーを有効化:</span>
                <div 
                  onClick={() => setTimerEnabled(!timerEnabled)}
                  className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                    timerEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 bg-white w-4 h-4 transition-transform duration-200 ease-in-out rounded-full transform ${
                      timerEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            </div>
            
            {timerEnabled && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  タイマー間隔: {timerInterval} 分
                </label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={timerInterval}
                  onChange={(e) => setTimerInterval(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-4">
              <p>※ タイマーは設定した分数が経過すると音が鳴ります</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SokuShuchu;