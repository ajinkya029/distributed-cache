import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Search, Trash2, Zap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export default function App() {
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [prefix, setPrefix] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('{\n  "message": "hello cache"\n}');
  const [ttl, setTtl] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, currentStats] = await Promise.all([
        request(`/api/cache?limit=100&prefix=${encodeURIComponent(prefix)}`),
        request('/api/stats'),
      ]);
      setKeys(list.keys);
      setStats(currentStats);
    } catch (error) { setNotice(error.message); }
  }, [prefix]);

  useEffect(() => { refresh(); const id = setInterval(refresh, 8000); return () => clearInterval(id); }, [refresh]);

  async function save(event) {
    event.preventDefault();
    setNotice('');
    let parsed;
    try { parsed = JSON.parse(value); } catch { setNotice('Value must be valid JSON.'); return; }
    setBusy(true);
    try {
      await request(`/api/cache/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value: parsed, ttlSeconds: ttl ? Number(ttl) : null }),
      });
      setNotice(`Saved "${key}" successfully.`);
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function remove(cacheKey) {
    if (!window.confirm(`Delete cache key "${cacheKey}"?`)) return;
    try {
      await request(`/api/cache/${encodeURIComponent(cacheKey)}`, { method: 'DELETE' });
      setNotice(`Deleted "${cacheKey}".`);
      await refresh();
    } catch (error) { setNotice(error.message); }
  }

  async function inspect(cacheKey) {
    try {
      const result = await request(`/api/cache/${encodeURIComponent(cacheKey)}`);
      setKey(result.key);
      setValue(JSON.stringify(result.value, null, 2));
      setTtl('');
      setNotice(`Loaded "${cacheKey}" from ${result.source}. Save to update its value.`);
    } catch (error) { setNotice(error.message); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-icon"><Database size={22}/></div><div><strong>Cache<span>Grid</span></strong><small>DISTRIBUTED CACHE CONSOLE</small></div></div>
      <div className="top-actions"><span className="status-dot"/> API Console <button className="icon-button" onClick={refresh} title="Refresh"><RefreshCw size={17}/></button></div>
    </header>
    <main className="main">
      <section className="intro"><div><div className="eyebrow">SYSTEM OVERVIEW</div><h1>Distributed Cache</h1><p>Inspect keys, manage values, and monitor your cache node.</p></div><div className="node-pill"><span className="status-dot"/><div><small>ACTIVE NODE</small><strong>{stats?.nodeId || 'Connecting…'}</strong></div></div></section>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
      <section className="metrics">
        <Metric icon={<Database size={19}/>} label="LOCAL ENTRIES" value={stats?.localCache?.size ?? '—'} detail={`Capacity ${stats?.localCache?.maxEntries ?? '—'}`} />
        <Metric icon={<Zap size={19}/>} label="LOCAL HITS" value={stats?.localCache?.hits ?? '—'} detail="Process-local reads" />
        <Metric icon={<Activity size={19}/>} label="LOCAL MISSES" value={stats?.localCache?.misses ?? '—'} detail="Fallback to MongoDB" />
        <Metric icon={<Database size={19}/>} label="VISIBLE KEYS" value={keys.length} detail="Filtered list (max 100)" />
      </section>
      <section className="content-grid">
        <div className="panel form-panel"><div className="panel-heading"><div><h2>Write a cache entry</h2><p>Store a JSON value with an optional time-to-live.</p></div><span className="panel-symbol"><Zap size={18}/></span></div>
          <form onSubmit={save}>
            <label>Cache key<input required maxLength="512" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. user:42:profile"/></label>
            <label>Value <span className="label-hint">JSON</span><textarea required rows="8" value={value} onChange={e => setValue(e.target.value)} spellCheck="false"/></label>
            <label>TTL <span className="label-hint">SECONDS · OPTIONAL</span><input type="number" min="1" max="31536000" value={ttl} onChange={e => setTtl(e.target.value)} placeholder="No expiration"/></label>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save cache entry'}</button>
          </form>
        </div>
        <div className="panel keys-panel"><div className="panel-heading"><div><h2>Cache keys</h2><p>Browse and inspect stored entries.</p></div><span className="count-badge">{keys.length}</span></div>
          <div className="search-box"><Search size={17}/><input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Filter by key prefix…"/><button onClick={refresh} title="Refresh"><RefreshCw size={15}/></button></div>
          <div className="key-list">
            {keys.length === 0 ? <div className="empty"><Database size={28}/><strong>No keys found</strong><span>Save a value or change your prefix filter.</span></div> :
              keys.map(item => <div className="key-row" key={item.key}><button className="key-info" onClick={() => inspect(item.key)}><span className="key-name">{item.key}</span><span className="key-meta">{item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : 'No expiration'} · Updated {new Date(item.updatedAt).toLocaleString()}</span></button><button className="delete-button" onClick={() => remove(item.key)} title={`Delete ${item.key}`}><Trash2 size={16}/></button></div>)}
          </div>
          <div className="panel-footer"><span><span className="status-dot"/> Auto-refresh every 8 seconds</span><span>MongoDB shared store</span></div>
        </div>
      </section>
      <footer>CacheGrid · MERN Distributed Cache Starter <span>Development console · Add authentication before production use</span></footer>
    </main>
  </div>;
}

function Metric({ icon, label, value, detail }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{detail}</small></div>;
}
