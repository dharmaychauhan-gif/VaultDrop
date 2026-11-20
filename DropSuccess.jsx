import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Copy, Check, QrCode, Trash2, ArrowLeft, 
  ExternalLink, ShieldCheck, Flame, Clock, Key, AlertOctagon, 
  Smartphone, Monitor, Wifi
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { sounds } from '../lib/audio';

export default function DropSuccess({ dropData, onReset, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const [copiedMobile, setCopiedMobile] = useState(false);
  const [copiedKillToken, setCopiedKillToken] = useState(false);
  const [showQr, setShowQr] = useState(true); // default open so mobile users immediately see QR
  const [isRevoking, setIsRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [linkTarget, setLinkTarget] = useState('mobile'); // 'mobile' | 'pc'

  useEffect(() => {
    // Fetch LAN IP for mobile connectivity
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => {
        setNetworkInfo(data);
      })
      .catch(() => {});

    // Confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B']
      });
    } catch (e) {}
  }, []);

  // Computer / Localhost URL (Clean slash format without '&' to avoid link truncations)
  const localShareUrl = `${window.location.origin}/#/v/${dropData.id}/${dropData.keyString}`;

  // Mobile / Wi-Fi LAN URL (e.g. http://10.149.96.22:3001/#/v/...)
  const mobileShareUrl = networkInfo && networkInfo.localIp !== 'localhost'
    ? `${networkInfo.lanOrigin}/#/v/${dropData.id}/${dropData.keyString}`
    : localShareUrl;

  const activeShareUrl = linkTarget === 'mobile' ? mobileShareUrl : localShareUrl;

  const handleCopy = async (isMob = false) => {
    try {
      const urlToCopy = isMob ? mobileShareUrl : activeShareUrl;
      await navigator.clipboard.writeText(urlToCopy);
      if (isMob) {
        setCopiedMobile(true);
        setTimeout(() => setCopiedMobile(false), 2500);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      sounds.playCopy();
    } catch (e) {}
  };

  const handleCopyKillToken = async () => {
    try {
      await navigator.clipboard.writeText(dropData.killToken);
      setCopiedKillToken(true);
      sounds.playCopy();
      setTimeout(() => setCopiedKillToken(false), 2500);
    } catch (e) {}
  };

  const handleRevokeNow = async () => {
    if (!window.confirm('Are you sure you want to shred and destroy this drop immediately? This action is irreversible.')) {
      return;
    }

    try {
      setIsRevoking(true);
      const res = await fetch(`/api/vaults/${dropData.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killToken: dropData.killToken })
      });

      if (res.ok) {
        setRevoked(true);
        sounds.playShred();
        if (onRevoke) onRevoke(dropData.id);
      } else {
        alert('Failed to revoke vault.');
      }
    } catch (e) {
      alert('Revoke request failed.');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="vault-glass rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"></div>

        {/* Success Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/10 animate-fade-in">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          Vault Drop Ready!
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mb-6">
          Encrypted client-side. The key stays inside the URL hash fragment (#) and is never transmitted to our servers.
        </p>

        {/* Target Device Selector: Mobile (Wi-Fi) vs PC (Localhost) */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button
            onClick={() => { setLinkTarget('mobile'); sounds.playCopy(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              linkTarget === 'mobile'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile / Wi-Fi Link</span>
          </button>

          <button
            onClick={() => { setLinkTarget('pc'); sounds.playCopy(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              linkTarget === 'pc'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>PC / Localhost Link</span>
          </button>
        </div>

        {/* Wi-Fi Guide Notice if Mobile Target */}
        {linkTarget === 'mobile' && networkInfo && networkInfo.localIp !== 'localhost' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono flex items-center justify-center gap-2">
            <Wifi className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span>
              Wi-Fi Host: <strong>{networkInfo.localIp}</strong> (Mobile phone should be on the same Wi-Fi)
            </span>
          </div>
        )}

        {/* Burn Warning Tip for Sender */}
        {dropData.burnAfterRead && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left flex items-start gap-2.5">
            <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Burn on 1st Read Active:</strong> Is link ko test karne ke liye pehle apne PC par open mat karein! Jaise hi koi is link ko 1st time unlock karega, ye permanently shred ho jayega. Seedha mobile phone se scan karein.
            </div>
          </div>
        )}

        {/* Share Link Box */}
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 mb-6 text-left flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
          <div className="truncate flex-1 font-mono text-xs text-emerald-300 select-all pr-2">
            {activeShareUrl}
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => handleCopy(false)}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={() => { setShowQr(!showQr); sounds.playCopy(); }}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                showQr 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400'
              }`}
              title="Toggle QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* QR Code (Uses Mobile/Wi-Fi URL by default so scanning on phone connects directly) */}
        {showQr && (
          <div className="mb-6 p-5 bg-slate-950 rounded-2xl border border-slate-800 inline-block mx-auto animate-fade-in shadow-xl">
            <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-emerald-400 mb-2 font-semibold">
              <QrCode className="w-4 h-4" />
              <span>Scan on iPhone / Android (Safari & Chrome)</span>
            </div>
            
            <p className="text-[11px] font-mono text-slate-400 mb-3 max-w-xs mx-auto">
              Scans with network IP (<code className="text-emerald-300 font-bold">{networkInfo?.localIp || 'Wi-Fi IP'}</code>). Phone must be on the same Wi-Fi network.
            </p>

            <div className="p-3 bg-white rounded-xl inline-block shadow-lg">
              <QRCodeSVG
                value={mobileShareUrl}
                size={190}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>
        )}

        {/* Drop Details Pill List */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 text-left">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Type</span>
            <span className="text-xs font-semibold text-slate-200 capitalize">{dropData.type} Drop</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Destruction</span>
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {dropData.burnAfterRead ? '1 View Burn' : `${dropData.maxDownloads} Downloads`}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Expires</span>
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(dropData.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Passphrase</span>
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
              <Key className="w-3 h-3 text-emerald-400" />
              {dropData.hasPassphrase ? 'Protected' : 'None'}
            </span>
          </div>
        </div>

        {/* Sender Kill Switch Control */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 text-left mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-red-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <AlertOctagon className="w-3.5 h-3.5" />
              Sender Emergency Kill Switch
            </span>
            {revoked && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                SHREDDED
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Changed your mind? You can destroy this drop from server storage before anyone reads it.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500">
              <span>Token:</span>
              <code className="text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 select-all">
                {dropData.killToken.substring(0, 16)}...
              </code>
              <button
                onClick={handleCopyKillToken}
                className="text-slate-400 hover:text-emerald-400"
                title="Copy full kill token"
              >
                {copiedKillToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {!revoked ? (
              <button
                onClick={handleRevokeNow}
                disabled={isRevoking}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isRevoking ? 'Shredding...' : 'Nuke Drop Now'}</span>
              </button>
            ) : (
              <span className="text-xs font-mono text-red-400">Vault permanently obliterated.</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => { onReset(); sounds.playCopy(); }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Create Another Drop</span>
          </button>

          <a
            href={localShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <span>Open in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
