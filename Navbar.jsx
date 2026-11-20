import React, { useEffect, useState } from 'react';
import { Shield, Lock, Trash2, Volume2, VolumeX, Eye, Terminal, Sparkles, Layers } from 'lucide-react';
import { sounds } from '../lib/audio';

export default function Navbar({ activeTab, setActiveTab, unreadDropsCount = 0 }) {
  const [stats, setStats] = useState({ totalCreated: 0, totalShredded: 0, activeVaults: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      // offline / starting up
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
    if (next) sounds.playCopy();
  };

  return (
    <header className="border-b border-slate-800/80 bg-vault-bg/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div 
          onClick={() => setActiveTab('create')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform duration-300">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-emerald-300 bg-clip-text text-transparent">
                VaultDrop
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Zero-Knowledge
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-emerald-400 inline" /> Client-Side AES-256-GCM
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setActiveTab('create'); sounds.playCopy(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center space-x-1.5 ${
              activeTab === 'create'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Drop</span>
          </button>

          <button
            onClick={() => { setActiveTab('mydrops'); sounds.playCopy(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center space-x-1.5 relative ${
              activeTab === 'mydrops'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>My Outbox</span>
            {unreadDropsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-bold">
                {unreadDropsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('architecture'); sounds.playCopy(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center space-x-1.5 hidden md:flex ${
              activeTab === 'architecture'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>How it Works</span>
          </button>
        </nav>

        {/* Global Shredded Ticker & Settings */}
        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-2 text-xs font-mono px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400">
            <span className="flex items-center gap-1 text-red-400">
              <Trash2 className="w-3 h-3 text-red-400" />
              <strong className="text-slate-200">{stats.totalShredded}</strong> shredded
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <strong>{stats.activeVaults}</strong> active
            </span>
          </div>

          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Cyber Audio' : 'Enable Cyber Audio'}
            className="w-9 h-9 rounded-lg border border-slate-800 bg-slate-900/80 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
}
