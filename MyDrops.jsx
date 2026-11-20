import React, { useState, useEffect } from 'react';
import { 
  Layers, Trash2, ExternalLink, Copy, Check, Clock, 
  Flame, Key, AlertOctagon, ShieldCheck, RefreshCw, Sparkles 
} from 'lucide-react';
import { sounds } from '../lib/audio';

export default function MyDrops({ onSelectDrop, onCreateNew }) {
  const [drops, setDrops] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  useEffect(() => {
    loadDrops();
  }, []);

  const loadDrops = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('vaultdrop_outbox') || '[]');
      setDrops(stored);
      checkStatuses(stored);
    } catch (e) {
      console.error(e);
    }
  };

  const checkStatuses = async (dropList) => {
    setLoadingStatuses(true);
    const newStatuses = {};

    for (const drop of dropList) {
      try {
        const res = await fetch(`/api/vaults/${drop.id}/status?token=${drop.killToken}`);
        if (res.ok) {
          const data = await res.json();
          newStatuses[drop.id] = data;
        } else {
          newStatuses[drop.id] = { status: 'shredded' };
        }
      } catch (e) {
        newStatuses[drop.id] = { status: 'unknown' };
      }
    }

    setStatuses(newStatuses);
    setLoadingStatuses(false);
  };

  const handleCopyLink = (drop) => {
    const url = `${window.location.origin}/#/v/${drop.id}/${drop.keyString}`;
    navigator.clipboard.writeText(url);
    setCopiedId(drop.id);
    sounds.playCopy();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (drop) => {
    if (!window.confirm(`Are you sure you want to permanently shred "${drop.name || drop.id}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/vaults/${drop.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killToken: drop.killToken })
      });

      if (res.ok) {
        sounds.playShred();
        setStatuses(prev => ({
          ...prev,
          [drop.id]: { ...(prev[drop.id] || {}), status: 'revoked' }
        }));
      }
    } catch (e) {
      alert('Revoke failed');
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear your local drop history? (This does not delete active vaults from server)')) {
      localStorage.removeItem('vaultdrop_outbox');
      setDrops([]);
      setStatuses({});
      sounds.playShred();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-emerald-400" />
            My Active Vault Drops
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Locally tracked drops created on this device. Manage and emergency-revoke anytime.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => checkStatuses(drops)}
            disabled={loadingStatuses}
            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-emerald-400 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatuses ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          {drops.length > 0 && (
            <button
              onClick={clearHistory}
              className="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-red-500/30 bg-slate-900 text-slate-400 hover:text-red-400 text-xs font-mono transition-colors cursor-pointer"
            >
              Clear Outbox
            </button>
          )}
        </div>
      </div>

      {drops.length === 0 ? (
        <div className="vault-glass rounded-2xl p-12 text-center border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-600">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">No Drops Recorded</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            You haven't created any zero-knowledge encrypted drops from this browser session yet.
          </p>
          <button
            onClick={onCreateNew}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Your First Drop</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {drops.map((drop) => {
            const statusObj = statuses[drop.id] || {};
            const currentStatus = statusObj.status || 'checking';
            const isAlive = currentStatus === 'active';

            return (
              <div
                key={drop.id}
                className="vault-glass rounded-xl p-4 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 vault-glass-hover"
              >
                {/* Left: Info */}
                <div className="flex items-start space-x-3 truncate">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isAlive 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    {drop.type === 'file' ? <Layers className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-100 truncate">{drop.name || 'Encrypted Drop'}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {drop.type}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500 mt-1">
                      <span>Created {new Date(drop.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>{drop.burnAfterRead ? 'Burn on Read' : `${drop.maxDownloads} downloads limit`}</span>
                      {drop.hasPassphrase && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400">Passphrase Protected</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status badge & Actions */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {/* Status Badge */}
                  <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border font-semibold ${
                    currentStatus === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : currentStatus === 'burned'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : currentStatus === 'expired'
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {currentStatus.toUpperCase()}
                  </span>

                  {/* Copy Link */}
                  {isAlive && (
                    <button
                      onClick={() => handleCopyLink(drop)}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 transition-colors"
                      title="Copy Share Link"
                    >
                      {copiedId === drop.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Nuke / Shred Action */}
                  {isAlive && (
                    <button
                      onClick={() => handleRevoke(drop)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono font-semibold transition-all flex items-center space-x-1 cursor-pointer"
                      title="Emergency Shred Now"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Shred</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
