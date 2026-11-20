import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DropCreator from './components/DropCreator';
import DropSuccess from './components/DropSuccess';
import DropViewer from './components/DropViewer';
import MyDrops from './components/MyDrops';
import AuditExplainer from './components/AuditExplainer';
import { Shield, Lock, Terminal, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'mydrops', 'architecture', 'view'
  const [createdDrop, setCreatedDrop] = useState(null);
  const [viewingVault, setViewingVault] = useState(null); // { vaultId, keyString }

  // Check URL hash / pathname on load and when hash changes
  useEffect(() => {
    const parseUrl = () => {
      const hash = window.location.hash || '';
      const pathname = window.location.pathname || '';

      let foundId = null;
      let foundKey = null;

      // Format 1: #/v/:id/:key or #v/:id/:key (clean slash format, no & operator)
      if (hash.startsWith('#/v/') || hash.startsWith('#v/')) {
        const parts = hash.replace(/^#\/?v\//, '').split('/');
        foundId = parts[0];
        foundKey = parts[1] || null;
      }
      // Format 2: #drop=XYZ&k=ABC or #v=XYZ&k=ABC
      else if (hash.includes('drop=') || hash.includes('v=')) {
        const cleanHash = hash.replace(/^[#\/?]+/, '');
        const hashParams = new URLSearchParams(cleanHash);
        foundId = hashParams.get('drop') || hashParams.get('v');
        foundKey = hashParams.get('k');
      } 
      // Format 3: /v/XYZ#k=ABC or /v/XYZ#:key
      else if (pathname.startsWith('/v/')) {
        foundId = pathname.split('/v/')[1]?.split('/')[0];
        if (hash) {
          const cleanHash = hash.replace(/^[#\/?]+/, '');
          const hashParams = new URLSearchParams(cleanHash);
          foundKey = hashParams.get('k') || cleanHash.replace(/^k=/, '');
        }
      }

      if (foundId) {
        setViewingVault({ vaultId: foundId, keyString: foundKey || '' });
        setActiveTab('view');
      }
    };

    parseUrl();
    window.addEventListener('hashchange', parseUrl);
    window.addEventListener('popstate', parseUrl);

    return () => {
      window.removeEventListener('hashchange', parseUrl);
      window.removeEventListener('popstate', parseUrl);
    };
  }, []);

  const handleDropCreated = (data) => {
    setCreatedDrop(data);
  };

  const handleResetCreator = () => {
    setCreatedDrop(null);
    setActiveTab('create');
  };

  const handleGoHome = () => {
    window.location.hash = '';
    setViewingVault(null);
    setCreatedDrop(null);
    setActiveTab('create');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between cyber-grid">
      <div>
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'create') setCreatedDrop(null);
            if (tab !== 'view') setViewingVault(null);
          }} 
        />

        <main className="pb-16">
          {/* View Drop if visiting a shared link */}
          {activeTab === 'view' && viewingVault ? (
            <DropViewer
              vaultId={viewingVault.vaultId}
              keyString={viewingVault.keyString}
              onGoHome={handleGoHome}
            />
          ) : createdDrop ? (
            /* Success Screen after creating a drop */
            <DropSuccess
              dropData={createdDrop}
              onReset={handleResetCreator}
              onRevoke={(id) => {
                // Remove from local active outbox view if revoked
              }}
            />
          ) : activeTab === 'create' ? (
            /* Drop Creator */
            <DropCreator onDropCreated={handleDropCreated} />
          ) : activeTab === 'mydrops' ? (
            /* Sender Outbox */
            <MyDrops
              onSelectDrop={(drop) => {}}
              onCreateNew={() => setActiveTab('create')}
            />
          ) : (
            /* Architecture & Audit Explainer */
            <AuditExplainer />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 backdrop-blur-md py-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400 font-bold">VaultDrop SaaS</span>
            <span>•</span>
            <span>Zero-Knowledge Architecture</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>AES-256-GCM</span>
            <span>•</span>
            <span>PBKDF2-100k</span>
            <span>•</span>
            <span>DoD 5220.22-M Shredder</span>
          </div>

          <div>
            Built with Privacy First
          </div>
        </div>
      </footer>
    </div>
  );
}
