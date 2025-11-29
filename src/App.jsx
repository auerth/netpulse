import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  Play, Square, Download, Wifi, Activity, 
  Clock, Settings, ChevronDown, ChevronUp, ArrowDownCircle, Info, X, Zap, Server
} from 'lucide-react';

const App = () => {
  // --- BRAND COLORS & FONTS ---
  const colors = {
    bg: '#FFFFFF',          
    text: '#21264E',        
    primary: '#194093',     
    secondary: '#A3C7EB',   
    accent: '#F18557',      
    highlight: '#F7AE67',   
    danger: '#E36150',      
    chartBlue: '#194093',
    chartOrange: '#F18557',
    grid: '#e2e8f0'
  };

  // --- CONFIG STATE ---
  const [durationHours, setDurationHours] = useState(3);
  const [pingInterval, setPingInterval] = useState(2); 
  const [speedInterval, setSpeedInterval] = useState(5); 
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pingUrl, setPingUrl] = useState('https://www.google.com/favicon.ico');
  
  // Standard: Cloudflare 100MB (Sicherer Standard, user kann auf 1GB umschalten)
  // Cloudflare __down endpoint generiert zufällige Bytes und ist CORS-freundlich
  const [downloadUrl, setDownloadUrl] = useState('https://speed.cloudflare.com/__down?bytes=104857600');

  // --- APP STATE ---
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]); 
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pingErrors, setPingErrors] = useState(0);
  
  // Neuer State für Live-Download und Dialog
  const [downloadState, setDownloadState] = useState({
    active: false,
    progress: 0,
    currentSpeed: 0,
    downloadedMb: 0,
    totalMb: 0
  });
  const [selectedLog, setSelectedLog] = useState(null); // Für den Dialog

  const timerRef = useRef(null);
  const endTimeRef = useRef(null);
  const nextSpeedTestRef = useRef(0);
  const abortControllerRef = useRef(null); // Um Downloads abzubrechen

  // --- HELPER ---
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const getCurrentTimeStr = () => {
    return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // --- PRESETS ---
  const downloadPresets = [
    { label: 'CF 100MB', size: '100MB', url: 'https://speed.cloudflare.com/__down?bytes=104857600' },
    { label: 'CF 500MB', size: '500MB', url: 'https://speed.cloudflare.com/__down?bytes=524288000' },
    { label: 'CF 1GB',   size: '1GB',   url: 'https://speed.cloudflare.com/__down?bytes=1073741824' },
  ];

  const applyPreset = (url) => {
    setDownloadUrl(url);
  };

  // --- PING TEST ---
  const runPingTest = async () => {
    // Ping läuft nicht parallel zum Download, um Ergebnisse nicht zu verfälschen
    if(downloadState.active) return;

    const timestamp = Date.now();
    const target = pingUrl.trim() || 'https://www.google.com/favicon.ico';
    const uniqueUrl = `${target}?t=${timestamp}`;
    const start = performance.now();

    try {
      await fetch(uniqueUrl, { mode: 'no-cors', cache: 'no-store' });
      const end = performance.now();
      const latency = Math.round(end - start);

      addLogEntry({
        type: 'ping',
        time: getCurrentTimeStr(),
        timestamp: timestamp,
        latency: latency,
        status: 'ok'
      });
    } catch (error) {
      setPingErrors(prev => prev + 1);
      addLogEntry({
        type: 'ping',
        time: getCurrentTimeStr(),
        timestamp: timestamp,
        latency: 0,
        status: 'error'
      });
    }
  };

  // --- STREAMING SPEED TEST ---
  const runSpeedTest = async () => {
    const timestamp = Date.now();
    // Falls keine URL gesetzt ist, Fallback auf Cloudflare 100MB
    const target = downloadUrl.trim() || 'https://speed.cloudflare.com/__down?bytes=104857600';
    
    // Cloudflare braucht kein Cache-Busting Parameter bei __down, aber schadet nicht
    // Wichtig: Bei Cloudflare __down URL ist der Inhalt dynamisch generiert
    const uniqueUrl = target.includes('?') ? `${target}&t=${timestamp}` : `${target}?t=${timestamp}`;
    
    // Abort Controller für sauberes Abbrechen
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setDownloadState({ active: true, progress: 0, currentSpeed: 0, downloadedMb: 0, totalMb: 0 });

    const startTime = performance.now();
    let receivedLength = 0;
    let lastUpdateRecieved = 0;
    let lastUpdateTime = startTime;
    let historyData = []; // Speichert den Verlauf DIESES Downloads

    try {
      const response = await fetch(uniqueUrl, { 
        signal: abortControllerRef.current.signal,
        cache: 'no-store'
      });

      const reader = response.body.getReader();
      const contentLengthHeader = response.headers.get('Content-Length');
      
      // Bestimme Gesamtgröße:
      // 1. Content-Length Header
      // 2. "bytes" Parameter in der URL (für Cloudflare)
      // 3. Fallback 100 MB
      let calculatedTotal = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      
      if (!calculatedTotal) {
          try {
              // Versuche bytes Parameter aus URL zu lesen
              const urlObj = new URL(target);
              const bytesParam = urlObj.searchParams.get('bytes');
              if (bytesParam) {
                  calculatedTotal = parseInt(bytesParam, 10);
              }
          } catch (e) {
              // Ignore URL parsing errors
          }
      }

      // Finaler Fallback
      const totalLength = calculatedTotal || (100 * 1024 * 1024);

      while(true) {
        const {done, value} = await reader.read();
        if (done) break;

        receivedLength += value.length;
        
        const now = performance.now();
        const timeSinceLastUpdate = now - lastUpdateTime;

        // UI Updates & Messung alle ~150ms (verhindert UI Lag bei Highspeed)
        if (timeSinceLastUpdate > 150) {
          const chunkBytes = receivedLength - lastUpdateRecieved;
          const chunkSeconds = timeSinceLastUpdate / 1000;
          
          // Momentangeschwindigkeit berechnen
          const instantSpeedBps = (chunkBytes * 8) / chunkSeconds;
          const instantSpeedMbps = (instantSpeedBps / (1024 * 1024)).toFixed(1);
          
          const progressPercent = Math.min(100, Math.round((receivedLength / totalLength) * 100));
          const downloadedMb = (receivedLength / (1024 * 1024)).toFixed(1);
          const totalMb = (totalLength / (1024 * 1024)).toFixed(1);

          setDownloadState({
            active: true,
            progress: progressPercent,
            currentSpeed: instantSpeedMbps,
            downloadedMb,
            totalMb
          });

          // Verlauf speichern für den Dialog später
          historyData.push({
            tick: Math.round((now - startTime)), // ms seit start
            speed: parseFloat(instantSpeedMbps),
            mb: parseFloat(downloadedMb)
          });

          lastUpdateTime = now;
          lastUpdateRecieved = receivedLength;
        }
      }

      // -- FERTIG --
      const endTime = performance.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const avgSpeedBps = (receivedLength * 8) / durationSeconds;
      const avgSpeedMbps = (avgSpeedBps / (1024 * 1024)).toFixed(2);

      addLogEntry({
        type: 'speed',
        time: getCurrentTimeStr(),
        timestamp: timestamp,
        speed: parseFloat(avgSpeedMbps),
        size: receivedLength,
        duration: durationSeconds,
        history: historyData, // Der gesamte Verlauf wird gespeichert!
        status: 'ok'
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Download aborted');
      } else {
        console.error("Speedtest Error:", error);
        addLogEntry({
          type: 'speed',
          time: getCurrentTimeStr(),
          timestamp: timestamp,
          speed: 0,
          status: 'error'
        });
      }
    } finally {
      setDownloadState(prev => ({ ...prev, active: false }));
      abortControllerRef.current = null;
    }
  };

  const addLogEntry = (entry) => {
    setLogs(prev => {
      if (prev.length > 2000) return [...prev.slice(1), entry];
      return [...prev, entry]; 
    });
  };

  const toggleStart = () => {
    if (isRunning) {
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setDownloadState(prev => ({ ...prev, active: false }));
    } else {
      setLogs([]);
      setPingErrors(0);
      setElapsedTime(0);
      const start = Date.now();
      setStartTime(start);
      endTimeRef.current = start + (durationHours * 60 * 60 * 1000);
      nextSpeedTestRef.current = start; 
      setIsRunning(true);
    }
  };

  useEffect(() => {
    if (isRunning) {
      runPingTest();
      // Erster Speedtest sofort
      if (Date.now() >= nextSpeedTestRef.current) {
         runSpeedTest();
         nextSpeedTestRef.current = Date.now() + (speedInterval * 60 * 1000);
      }

      timerRef.current = setInterval(() => {
        const now = Date.now();
        if (now >= endTimeRef.current) {
          setIsRunning(false);
          clearInterval(timerRef.current);
          alert("Testdauer abgelaufen!");
          return;
        }

        setElapsedTime(now - startTime);
        runPingTest();

        if (now >= nextSpeedTestRef.current && !downloadState.active) {
          runSpeedTest();
          nextSpeedTestRef.current = now + (speedInterval * 60 * 1000);
        }

      }, pingInterval * 1000);
    }
    return () => {
       clearInterval(timerRef.current);
       if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isRunning, pingInterval, speedInterval, durationHours, startTime, pingUrl, downloadUrl]);

  // --- STATS ---
  const stats = useMemo(() => {
    const pings = logs.filter(l => l.type === 'ping' && l.status === 'ok');
    const speeds = logs.filter(l => l.type === 'speed' && l.status === 'ok');

    const avgPing = pings.length ? Math.round(pings.reduce((a, b) => a + b.latency, 0) / pings.length) : 0;
    const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b.speed, 0) / speeds.length).toFixed(1) : 0;
    const maxSpeed = speeds.length ? Math.max(...speeds.map(l => l.speed)).toFixed(1) : 0;
    const minSpeed = speeds.length ? Math.min(...speeds.map(l => l.speed)).toFixed(1) : 0;

    return { avgPing, avgSpeed, maxSpeed, minSpeed, countSpeed: speeds.length };
  }, [logs]);

  const downloadCSV = () => {
    if (logs.length === 0) return;
    let csv = "Zeitstempel,Uhrzeit,Typ,Wert(ms_oder_mbps),Status\n";
    logs.forEach(row => {
      const val = row.type === 'ping' ? row.latency : row.speed;
      csv += `${row.timestamp},${row.time},${row.type},${val},${row.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `softwelop_netpulse_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const chartData = logs.map(l => ({
    time: l.time,
    latency: l.type === 'ping' ? l.latency : null,
    speed: l.type === 'speed' ? l.speed : null,
    error: l.status === 'error' ? 1 : 0,
    fullLog: l // Referenz für den Click-Handler
  }));
  
  const speedChartData = logs.filter(l => l.type === 'speed');

  // Inject Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 relative" style={{ fontFamily: "'Montserrat', sans-serif", color: colors.text }}>
      
      {/* DETAIL DIALOG / MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                 <div>
                    <h3 className="text-xl font-bold" style={{ color: colors.primary }}>Download Detailanalyse</h3>
                    <p className="text-sm opacity-60">Messung vom {new Date(selectedLog.timestamp).toLocaleString()}</p>
                 </div>
                 <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                    <X className="w-6 h-6 text-slate-500" />
                 </button>
              </div>
              
              <div className="p-6 space-y-6">
                 <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl">
                       <div className="text-xs uppercase text-slate-500 font-semibold">Durchschnitt</div>
                       <div className="text-2xl font-bold" style={{color: colors.accent}}>{selectedLog.speed} <span className="text-sm">Mbit/s</span></div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                       <div className="text-xs uppercase text-slate-500 font-semibold">Datenvolumen</div>
                       <div className="text-2xl font-bold text-slate-700">{(selectedLog.size / (1024*1024)).toFixed(1)} <span className="text-sm">MB</span></div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                       <div className="text-xs uppercase text-slate-500 font-semibold">Dauer</div>
                       <div className="text-2xl font-bold text-slate-700">{selectedLog.duration?.toFixed(1) || '-'} <span className="text-sm">s</span></div>
                    </div>
                 </div>

                 {selectedLog.history && selectedLog.history.length > 0 ? (
                    <div className="h-64 w-full border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                       <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4"/> Geschwindigkeitsverlauf</h4>
                       <ResponsiveContainer width="100%" height="90%">
                          <LineChart data={selectedLog.history}>
                             <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                             <XAxis 
                                dataKey="tick" 
                                tickFormatter={(val) => (val/1000).toFixed(1) + 's'} 
                                stroke="#94a3b8" 
                                fontSize={11} 
                                tickLine={false} 
                                axisLine={false}
                             />
                             <YAxis stroke="#94a3b8" fontSize={11} unit=" Mbit" tickLine={false} axisLine={false} />
                             <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                labelFormatter={(val) => `Zeit: ${(val/1000).toFixed(1)}s`}
                             />
                             <Line type="monotone" dataKey="speed" stroke={colors.accent} strokeWidth={2} dot={false} activeDot={{r: 6}} />
                          </LineChart>
                       </ResponsiveContainer>
                    </div>
                 ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                       Keine Detaildaten für diesen Test verfügbar.
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}


      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER BRANDING */}
        <header className="flex flex-col md:flex-row justify-between items-center pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: colors.primary }}>
                softwelop <span className="font-light" style={{ color: colors.accent }}>NetPulse</span>
              </h1>
              <p className="text-sm font-light tracking-wide opacity-80">
                PROFESSIONAL NETWORK MONITORING
              </p>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center gap-3 px-6 py-3 rounded-full bg-slate-50 border border-slate-100 shadow-inner">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="font-mono font-medium text-2xl" style={{ color: colors.primary }}>{formatTime(elapsedTime)}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* SIDEBAR: CONFIGURATION */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: colors.text }}>
                <Settings className="w-4 h-4" /> Konfiguration
              </h2>
              
              <div className="space-y-5">
                <InputGroup label="Gesamtdauer (Stunden)" value={durationHours} setValue={setDurationHours} disabled={isRunning} />
                <InputGroup label="Ping Intervall (Sekunden)" value={pingInterval} setValue={setPingInterval} disabled={isRunning} />
                <InputGroup label="Speedtest Intervall (Minuten)" value={speedInterval} setValue={setSpeedInterval} disabled={isRunning} />

                {/* ADVANCED CONFIG TOGGLE */}
                <div className="border-t border-slate-100 pt-4 mt-2">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider transition-colors hover:text-blue-600"
                    style={{ color: colors.text }}
                  >
                    <span>Erweiterte Konfiguration</span>
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {showAdvanced && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div>
                        <label className="text-xs font-medium mb-1 block opacity-70">Ping URL</label>
                        <input type="text" value={pingUrl} onChange={(e) => setPingUrl(e.target.value)} disabled={isRunning} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" placeholder="https://..." />
                      </div>
                      
                      {/* DOWNLOAD CONFIG WITH PRESETS */}
                      <div>
                        <label className="text-xs font-medium mb-1 flex justify-between opacity-70">
                          <span>Download URL</span>
                          <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase"><Server className="w-3 h-3"/> High-Speed CDN</span>
                        </label>
                        <input type="text" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} disabled={isRunning} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none mb-2" placeholder="https://..." />
                        
                        <div className="grid grid-cols-3 gap-2">
                          {downloadPresets.map(preset => (
                            <button
                              key={preset.size}
                              onClick={() => applyPreset(preset.url)}
                              disabled={isRunning}
                              className={`text-[10px] font-bold py-1.5 rounded border transition ${
                                downloadUrl === preset.url 
                                  ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    onClick={toggleStart} 
                    className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${isRunning ? 'hover:bg-red-600' : 'hover:opacity-90'}`}
                    style={{ backgroundColor: isRunning ? colors.danger : colors.primary }}
                  >
                    {isRunning ? <><Square className="w-5 h-5 fill-current"/> STOP TEST</> : <><Play className="w-5 h-5 fill-current"/> START TEST</>}
                  </button>
                </div>
                
                {logs.length > 0 && !isRunning && (
                  <button onClick={downloadCSV} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-100 text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700 transition text-sm">
                    <Download className="w-4 h-4" /> Report als CSV
                  </button>
                )}
              </div>
            </div>

            {/* LIVE DOWNLOAD STATUS */}
            {downloadState.active && (
              <div className="bg-white p-5 rounded-2xl shadow-lg border border-blue-100 animate-in slide-in-from-left-2 duration-300">
                  <div className="flex justify-between items-center mb-2">
                     <div className="flex items-center gap-2 text-sm font-bold" style={{color: colors.accent}}>
                        <Zap className="w-4 h-4 fill-current animate-pulse" /> Live Speed
                     </div>
                     <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{downloadState.progress}%</span>
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{color: colors.accent}}>
                     {downloadState.currentSpeed} <span className="text-sm text-slate-400 font-normal">Mbit/s</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                     <div 
                        className="h-full rounded-full transition-all duration-200"
                        style={{ width: `${downloadState.progress}%`, backgroundColor: colors.accent }}
                     />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 uppercase font-medium">
                     <span>{downloadState.downloadedMb} MB geladen</span>
                     <span>{downloadState.totalMb > 0 ? `/ ${downloadState.totalMb} MB` : 'Stream'}</span>
                  </div>
              </div>
            )}

            {/* KPI TILES */}
            <div className="grid grid-cols-2 gap-4">
               <KpiTile label="Ø Ping" value={stats.avgPing} unit="ms" color={colors.primary} />
               <KpiTile label="Paketverlust" value={pingErrors} unit="Errors" color={pingErrors > 0 ? colors.danger : colors.secondary} isAlert={pingErrors > 0} />
               <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 col-span-2">
                 <div className="flex justify-between items-end">
                    <div>
                        <div className="text-xs uppercase tracking-wider font-semibold opacity-60 mb-1">Ø Download Speed</div>
                        <div className="text-3xl font-bold" style={{ color: colors.accent }}>{stats.avgSpeed} <span className="text-sm font-medium opacity-60 text-gray-500">Mbit/s</span></div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="text-xs font-medium text-gray-400">Max: {stats.maxSpeed}</div>
                        <div className="text-xs font-medium text-gray-400">Min: {stats.minSpeed}</div>
                    </div>
                 </div>
               </div>
            </div>
          </div>

          {/* MAIN CONTENT: CHARTS */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* CHART 1: SPEED */}
            <ChartContainer 
              title="Bandbreite (Download)" 
              subTitle={`${stats.countSpeed} Messungen - Klicke auf Balken für Details`} 
              icon={<ArrowDownCircle className="w-5 h-5"/>} 
              color={colors.accent}
            >
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={speedChartData}>
                   <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                   <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                   <YAxis stroke="#94a3b8" fontSize={11} unit=" Mbit" tickLine={false} axisLine={false} />
                   <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                      cursor={{fill: colors.secondary, opacity: 0.2}} 
                      formatter={(value) => [`${value} Mbit/s`, 'Durchschnitt']}
                   />
                   <Bar 
                      dataKey="speed" 
                      name="Geschwindigkeit" 
                      fill={colors.accent} 
                      radius={[6, 6, 0, 0]} 
                      barSize={40} 
                      isAnimationActive={false} 
                      cursor="pointer"
                      onClick={(data) => {
                         if (data && data.payload) {
                            setSelectedLog(data.payload);
                         }
                      }}
                      // Hover Effekt
                      onMouseOver={(data, index) => { /* Optional visual feedback */ }}
                   />
                 </BarChart>
               </ResponsiveContainer>
            </ChartContainer>

            {/* CHART 2: LATENCY */}
            <ChartContainer title="Latenz & Stabilität" subTitle={`Ping Interval: ${pingInterval}s`} icon={<Wifi className="w-5 h-5"/>} color={colors.primary}>
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData}>
                   <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                   <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickFormatter={(val, index) => index % 20 === 0 ? val : ''} tickLine={false} axisLine={false} />
                   <YAxis stroke="#94a3b8" fontSize={11} unit=" ms" tickLine={false} axisLine={false} />
                   <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                   <Line type="monotone" dataKey="latency" name="Ping" stroke={colors.primary} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                   {pingErrors > 0 && <Line type="monotone" dataKey="error" stroke="none" dot={{ stroke: colors.danger, strokeWidth: 2, r: 4, fill: colors.danger }} />}
                 </LineChart>
               </ResponsiveContainer>
            </ChartContainer>

          </div>
        </div>
      </div>
    </div>
  );
};

// UI Components
const InputGroup = ({ label, value, setValue, disabled }) => (
  <div>
    <label className="text-xs font-medium text-gray-500 mb-1 block uppercase tracking-wide">{label}</label>
    <input 
      type="number" 
      value={value} 
      onChange={e => setValue(Number(e.target.value))} 
      disabled={disabled} 
      min="1"
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition disabled:opacity-50" 
    />
  </div>
);

const KpiTile = ({ label, value, unit, color, isAlert }) => (
  <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between h-32 ${isAlert ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
    <div className="text-xs uppercase tracking-wider font-semibold opacity-60" style={{ color: isAlert ? 'red' : '#21264E' }}>{label}</div>
    <div>
      <div className="text-3xl font-bold" style={{ color: color }}>{value}</div>
      <div className="text-xs font-medium opacity-50 mt-1">{unit}</div>
    </div>
  </div>
);

const ChartContainer = ({ title, subTitle, icon, color, children }) => (
  <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 h-80 relative overflow-hidden group hover:shadow-xl transition-shadow duration-300">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: color }}>
        {icon} {title}
      </h3>
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-500">{subTitle}</span>
    </div>
    <div className="h-[80%] w-full">
      {children}
    </div>
  </div>
);

export default App;