import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, BellRing, Clock3, Crosshair, Database, Filter, Menu, RefreshCw, Settings2, SlidersHorizontal, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Signal = 'BUY' | 'SELL' | 'NEUTRAL';
type Decision = 'ACCEPT' | 'AVOID' | 'WATCH';
type StockRow = {
  symbol: string; ltp: number; changePct: number; bidPrice: number; bidQty: number;
  askPrice: number; askQty: number; smma20: number; smma120: number; etq5m: number;
  etq20m: number; etq60m: number; avgLtp20m: number; avgLtp60m: number; signal: Signal;
  confidence: number; decision: Decision; rationale: string; ltqBurst: number; lastUpdate: string;
};

const queryClient = new QueryClient();

const baseRows: StockRow[] = [
  { symbol: 'RELIANCE', ltp: 2948.35, changePct: 1.42, bidPrice: 2948.2, bidQty: 634, askPrice: 2948.5, askQty: 481, smma20: 2931.4, smma120: 2917.8, etq5m: 1.68, etq20m: 1.31, etq60m: 1.09, avgLtp20m: 2938.2, avgLtp60m: 2929.7, signal: 'BUY', confidence: 87, decision: 'ACCEPT', rationale: 'SMMA20 crossed above SMMA120 with expanding 5m ETQ and a bid-weighted book.', ltqBurst: 2.2, lastUpdate: '09:26:42' },
  { symbol: 'HDFCBANK', ltp: 1742.8, changePct: 0.86, bidPrice: 1742.7, bidQty: 812, askPrice: 1742.9, askQty: 905, smma20: 1738.1, smma120: 1729.6, etq5m: 1.41, etq20m: 1.2, etq60m: 1.04, avgLtp20m: 1739.6, avgLtp60m: 1733.2, signal: 'BUY', confidence: 79, decision: 'ACCEPT', rationale: 'Positive crossover is holding; liquidity is balanced while participation rises.', ltqBurst: 1.7, lastUpdate: '09:26:39' },
  { symbol: 'ICICIBANK', ltp: 1285.6, changePct: -0.54, bidPrice: 1285.5, bidQty: 430, askPrice: 1285.8, askQty: 765, smma20: 1289.7, smma120: 1294.1, etq5m: 0.82, etq20m: 0.94, etq60m: 1.02, avgLtp20m: 1288.2, avgLtp60m: 1290.6, signal: 'SELL', confidence: 74, decision: 'AVOID', rationale: 'Short average is below the long baseline; ask-side pressure confirms a weak tape.', ltqBurst: 1.3, lastUpdate: '09:26:34' },
  { symbol: 'TCS', ltp: 3921.25, changePct: 0.18, bidPrice: 3921.1, bidQty: 198, askPrice: 3921.4, askQty: 214, smma20: 3919.3, smma120: 3918.7, etq5m: 1.05, etq20m: 1.01, etq60m: 0.98, avgLtp20m: 3920.1, avgLtp60m: 3918.4, signal: 'NEUTRAL', confidence: 51, decision: 'WATCH', rationale: 'A narrow crossover with no participation impulse; wait for a cleaner separation.', ltqBurst: 0.9, lastUpdate: '09:26:31' },
  { symbol: 'INFY', ltp: 1548.7, changePct: -0.27, bidPrice: 1548.5, bidQty: 521, askPrice: 1548.9, askQty: 344, smma20: 1552.4, smma120: 1551.2, etq5m: 0.91, etq20m: 0.97, etq60m: 1.01, avgLtp20m: 1550.6, avgLtp60m: 1550.2, signal: 'NEUTRAL', confidence: 58, decision: 'WATCH', rationale: 'Short-term momentum has softened but the longer baseline is not yet broken.', ltqBurst: 1.1, lastUpdate: '09:26:27' },
  { symbol: 'SBIN', ltp: 812.45, changePct: 1.88, bidPrice: 812.4, bidQty: 1460, askPrice: 812.6, askQty: 721, smma20: 807.8, smma120: 799.4, etq5m: 1.92, etq20m: 1.5, etq60m: 1.21, avgLtp20m: 808.9, avgLtp60m: 804.4, signal: 'BUY', confidence: 91, decision: 'ACCEPT', rationale: 'Strong positive crossover, the highest liquidity burst in the set, and a bid-heavy book.', ltqBurst: 2.8, lastUpdate: '09:26:22' },
  { symbol: 'BHARTIARTL', ltp: 1688.1, changePct: -1.12, bidPrice: 1688, bidQty: 374, askPrice: 1688.4, askQty: 652, smma20: 1692.6, smma120: 1683.2, etq5m: 0.74, etq20m: 0.89, etq60m: 1.05, avgLtp20m: 1690.8, avgLtp60m: 1687.9, signal: 'SELL', confidence: 82, decision: 'AVOID', rationale: 'Price is losing the 20m mean while 5m participation contracts into the offer.', ltqBurst: 1.5, lastUpdate: '09:26:18' },
  { symbol: 'LT', ltp: 3610.9, changePct: 0.63, bidPrice: 3610.5, bidQty: 274, askPrice: 3611.1, askQty: 310, smma20: 3605.2, smma120: 3602.9, etq5m: 1.14, etq20m: 1.09, etq60m: 1.03, avgLtp20m: 3607.7, avgLtp60m: 3604.3, signal: 'BUY', confidence: 68, decision: 'WATCH', rationale: 'Crossover is constructive but the order book is too balanced for acceptance.', ltqBurst: 1.2, lastUpdate: '09:26:11' },
];

const journal = [
  { time: '09:24:18', symbol: 'SBIN', text: 'positive crossover confirmed · 2.8x LTQ burst', signal: 'BUY' },
  { time: '09:22:06', symbol: 'RELIANCE', text: 'SMMA20 reclaimed baseline · book skew +0.14', signal: 'BUY' },
  { time: '09:19:41', symbol: 'BHARTIARTL', text: 'negative crossover confirmed · ETQ contraction', signal: 'SELL' },
  { time: '09:16:53', symbol: 'ICICIBANK', text: 'ask pressure sustained · decision moved to avoid', signal: 'SELL' },
];

const fmt = (n: number, digits = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signalClass = (signal: Signal) => signal === 'BUY' ? 'signal-buy' : signal === 'SELL' ? 'signal-sell' : 'signal-neutral';
const decisionClass = (decision: Decision) => `decision-${decision.toLowerCase()}`;

function Sparkline({ positive = true }: { positive?: boolean }) {
  return <svg className="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
    <polyline fill="none" stroke={positive ? 'hsl(183 70% 32%)' : 'hsl(6 64% 47%)'} strokeWidth="1.5" points={positive ? '0,21 8,19 16,20 26,15 36,17 45,11 56,14 64,8 74,10 84,5 100,7' : '0,7 10,9 20,5 31,12 40,10 51,17 62,14 72,20 83,18 91,24 100,21'} />
  </svg>;
}

function MetricCard({ label, value, note, tone, positive }: { label: string; value: string; note: string; tone?: string; positive?: boolean }) {
  return <div className="metric-card" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="metric-label">{label}</div>
    <div className={`metric-value ${tone ?? ''}`}>{value}</div>
    <div className="metric-note">{note}</div>
    <Sparkline positive={positive !== false} />
  </div>;
}

function Dashboard() {
  const [rows, setRows] = useState(baseRows);
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [isDemo, setIsDemo] = useState(true);
  const [cadence, setCadence] = useState('5');
  const [isBooting, setIsBooting] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('09:26:42');
  const [filters, setFilters] = useState({ minLtp: '', maxLtp: '', minLiquidity: '', signal: 'ALL' });
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsBooting(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRows((current) => current.map((row) => {
        const nudge = (Math.random() - .48) * .22;
        return { ...row, ltp: +(row.ltp + nudge).toFixed(2), changePct: +(row.changePct + nudge / 10).toFixed(2), lastUpdate: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
      }));
      setLastRefresh(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, Number(cadence) * 1000);
    return () => window.clearInterval(timer);
  }, [cadence]);

  const visibleRows = useMemo(() => rows.filter((row) =>
    (!filters.minLtp || row.ltp >= Number(filters.minLtp)) &&
    (!filters.maxLtp || row.ltp <= Number(filters.maxLtp)) &&
    (!filters.minLiquidity || row.ltqBurst >= Number(filters.minLiquidity)) &&
    (filters.signal === 'ALL' || row.signal === filters.signal)
  ), [filters, rows]);
  const selected = rows.find((row) => row.symbol === selectedSymbol) ?? rows[0];

  const refreshNow = () => {
    setRows((current) => current.map((row) => ({ ...row, ltp: +(row.ltp + (Math.random() - .45) * .3).toFixed(2) })));
    setLastRefresh(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };
  const applyFilters = () => setFilters(draftFilters);
  const resetFilters = () => {
    const clean = { minLtp: '', maxLtp: '', minLiquidity: '', signal: 'ALL' };
    setDraftFilters(clean);
    setFilters(clean);
  };

  if (isBooting) return <LoadingShell />;
  return <div className="app-shell">
    <aside className="side-rail">
      <div className="brand">
        <div className="brand-mark"><span /></div>
        <div className="brand-copy">CROSS//SIGNAL<small>nse research cockpit</small></div>
      </div>
      <div className="rail-label">Workspace</div>
      <nav className="rail-nav" aria-label="Primary navigation">
        <button className="rail-item active" data-testid="nav-screening"><Crosshair size={15} /> Live screening</button>
        <button className="rail-item" data-testid="nav-journal"><Clock3 size={15} /> Crossover journal</button>
      </nav>
      <div className="rail-label" style={{ marginTop: 28 }}>System</div>
      <nav className="rail-nav">
        <button className="rail-item" data-testid="nav-data-health"><Database size={15} /> Data health</button>
        <button className="rail-item" data-testid="nav-settings"><Settings2 size={15} /> Research settings</button>
      </nav>
      <div className="rail-spacer" />
      <div className="rail-footer"><strong>Model profile / v0.8.4</strong>SMMA crossover · ETQ participation<br />Universe · NSE 500 · IST</div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <button className="ghost-icon mobile-only" data-testid="button-open-menu" aria-label="Open navigation"><Menu size={17} /></button>
          <div><div className="section-kicker">Research workspace / NSE</div><div className="topbar-title">Signal monitor</div></div>
        </div>
        <div className="topbar-right">
          <div className="session-pill"><span className="session-dot" /> Market open · 09:15–15:30 IST</div>
          <div className="mode-pill"><Zap size={12} /><button className="mode-toggle" onClick={() => setIsDemo((value) => !value)} data-testid="button-toggle-mode">{isDemo ? 'DEMO PRESENTATION' : 'LIVE PRESENTATION'}</button></div>
          <button className="ghost-icon" data-testid="button-notifications" aria-label="Notifications"><BellRing size={15} /></button>
        </div>
      </header>

      <div className="content">
        <section className="hero">
          <div><div className="section-kicker">Crossover engine / 01</div><h1>Read the tape<br />before it moves.</h1><p>Screening NSE names for SMMA regime shifts, liquidity confirmation, and a decision you can audit. Signals are ranked by evidence, not volume.</p></div>
          <div className="hero-meta"><span className="pulse-line" /> Engine active <span style={{ opacity: .4 }}>·</span> last tick {lastRefresh} IST</div>
        </section>

        <section className="metric-strip">
          <MetricCard label="Universe scanned" value="486" note="NSE 500 · 14 excluded for data quality" tone="teal" />
          <MetricCard label="Positive crossover" value="18" note="3 new since session open" tone="teal" />
          <MetricCard label="Acceptance rate" value="6.8%" note="31 signals → 18 accepted / watched" tone="amber" positive={false} />
          <MetricCard label="Data freshness" value="0.8s" note="Quote stream · 99.4% packets present" tone="teal" />
        </section>

        <div className="workspace">
          <section className="panel" aria-label="Live screener">
            <div className="panel-header">
              <div><div className="panel-title">Live screener</div><div className="panel-subtitle">Evidence-ranked candidates · {visibleRows.length} of {rows.length} displayed</div></div>
              <div className="panel-actions"><span className="section-kicker">Refresh</span><select className="control-select" value={cadence} onChange={(event) => setCadence(event.target.value)} data-testid="select-refresh-cadence" aria-label="Refresh cadence"><option value="2">2 sec</option><option value="5">5 sec</option><option value="15">15 sec</option><option value="30">30 sec</option></select><button className="ghost-icon" onClick={refreshNow} data-testid="button-refresh-now" aria-label="Refresh now"><RefreshCw size={14} /></button></div>
            </div>
            <div className="filterbar">
              <SlidersHorizontal size={14} color="hsl(183 70% 32%)" />
              <div className="filter-field"><span className="filter-label">LTP ₹</span><input className="control-input" type="number" placeholder="min" value={draftFilters.minLtp} onChange={(event) => setDraftFilters({ ...draftFilters, minLtp: event.target.value })} data-testid="input-min-ltp" aria-label="Minimum LTP" /></div>
              <div className="filter-field"><span className="filter-label">to</span><input className="control-input" type="number" placeholder="max" value={draftFilters.maxLtp} onChange={(event) => setDraftFilters({ ...draftFilters, maxLtp: event.target.value })} data-testid="input-max-ltp" aria-label="Maximum LTP" /></div>
              <div className="filter-field"><span className="filter-label">LTQ burst ≥</span><input className="control-input" type="number" step=".1" placeholder="1.0x" value={draftFilters.minLiquidity} onChange={(event) => setDraftFilters({ ...draftFilters, minLiquidity: event.target.value })} data-testid="input-min-liquidity" aria-label="Minimum liquidity burst" /></div>
              <div className="filter-field"><span className="filter-label">Signal</span><select className="control-select" value={draftFilters.signal} onChange={(event) => setDraftFilters({ ...draftFilters, signal: event.target.value })} data-testid="select-signal-filter" aria-label="Signal filter"><option value="ALL">All signals</option><option value="BUY">Buy only</option><option value="SELL">Sell only</option><option value="NEUTRAL">Neutral only</option></select></div>
              <button className="apply-btn" onClick={applyFilters} data-testid="button-apply-filters">Apply filters</button><button className="reset-btn" onClick={resetFilters} data-testid="button-reset-filters">Reset</button>
            </div>
            <div className="table-wrap">
              <div className="data-table">
                <div className="table-head"><div>Instrument</div><div>LTP / chg</div><div>Book</div><div>SMMA 20</div><div>SMMA 120</div><div>ETQ 5m / 20m</div><div>Avg LTP 20m</div><div>Signal</div><div>Decision</div></div>
                {visibleRows.length === 0 ? <div className="empty-state"><Filter size={23} /><strong>No names match this cut</strong><span>Widen the LTP or liquidity gate to restore the screener.</span></div> : visibleRows.map((row) => <button key={row.symbol} className={`table-row ${selectedSymbol === row.symbol ? 'selected' : ''}`} onClick={() => setSelectedSymbol(row.symbol)} data-testid={`row-stock-${row.symbol}`} aria-label={`Select ${row.symbol}`}>
                  <div className="table-cell symbol-cell">{row.symbol}<span>NSE · EQ</span></div>
                  <div className={`table-cell ${row.changePct >= 0 ? 'teal' : 'red'}`}>₹{fmt(row.ltp)}<span className="cell-sub">{row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%</span></div>
                  <div className="table-cell">{row.bidQty.toLocaleString('en-IN')} / {row.askQty.toLocaleString('en-IN')}<span className="cell-sub">bid / ask</span></div>
                  <div className="table-cell">{fmt(row.smma20)}<span className="cell-sub">{row.smma20 > row.smma120 ? 'above long' : 'below long'}</span></div>
                  <div className="table-cell">{fmt(row.smma120)}<span className="cell-sub">baseline</span></div>
                  <div className="table-cell">{row.etq5m.toFixed(2)}x / {row.etq20m.toFixed(2)}x<span className="cell-sub">ETQ ratio</span></div>
                  <div className="table-cell">₹{fmt(row.avgLtp20m)}<span className="cell-sub">60m ₹{fmt(row.avgLtp60m)}</span></div>
                  <div className="table-cell"><span className={`signal-chip ${signalClass(row.signal)}`}>{row.signal}</span><span className="cell-sub">{row.confidence}% confidence</span></div>
                  <div className="table-cell"><span className={`decision-chip ${decisionClass(row.decision)}`}>{row.decision}</span></div>
                </button>)}
              </div>
            </div>
          </section>

          <aside className="detail-stack">
            <section className="panel detail-card" aria-label="Selected symbol detail">
              <div className="detail-heading">
                <div><div className="section-kicker" style={{ color: '#9caeaa' }}>Selected instrument</div><div className="detail-symbol">{selected.symbol}</div><div className="detail-exchange">NSE · EQUITY · updated {selected.lastUpdate}</div></div>
                <div className="detail-ltp">₹{fmt(selected.ltp)}<small>{selected.changePct >= 0 ? '+' : ''}{selected.changePct.toFixed(2)}% session</small></div>
              </div>
              <div className="context">
                <div className="context-label">SMMA crossover context</div>
                <div className="cross-bar"><div className="cross-line short" /><div className="cross-line long" /><div className="cross-point" /></div>
                <div className="cross-axis"><span>−120 min</span><span>crossover</span><span>now</span></div>
                <div className="legend"><span><i /> SMMA 20 · {fmt(selected.smma20)}</span><span><i className="long" /> SMMA 120 · {fmt(selected.smma120)}</span></div>
                <div className="factor-list">
                  <div className="factor"><span className="factor-name">Trend spread</span><span className={`factor-value ${selected.smma20 > selected.smma120 ? 'positive' : 'negative'}`}>{selected.smma20 > selected.smma120 ? '+' : ''}{fmt(selected.smma20 - selected.smma120)} pts</span></div>
                  <div className="factor"><span className="factor-name">Participation impulse</span><span className="factor-value positive">{selected.etq5m.toFixed(2)}x baseline</span></div>
                  <div className="factor"><span className="factor-name">Order book skew</span><span className={`factor-value ${selected.bidQty > selected.askQty ? 'positive' : 'negative'}`}>{selected.bidQty > selected.askQty ? '+' : ''}{((selected.bidQty - selected.askQty) / (selected.bidQty + selected.askQty) * 100).toFixed(1)}% bid</span></div>
                  <div className="factor"><span className="factor-name">LTQ burst</span><span className="factor-value positive">{selected.ltqBurst.toFixed(1)}x · last 5m</span></div>
                </div>
                <div className="rationale"><strong>Why {selected.decision.toLowerCase()}:</strong> {selected.rationale}</div>
              </div>
            </section>

            <section className="panel journal" aria-label="Recent crossover journal">
              <div className="panel-header"><div><div className="panel-title">Recent crossover journal</div><div className="panel-subtitle">Session events · newest first</div></div><Activity size={15} color="hsl(183 70% 32%)" /></div>
              {journal.map((entry) => <div className="journal-entry" key={`${entry.time}-${entry.symbol}`} data-testid={`journal-entry-${entry.symbol}`}><div className="journal-time">{entry.time}</div><div><div className="journal-symbol">{entry.symbol}</div><div className="journal-copy">{entry.text}</div></div><span className={`journal-tag ${entry.signal.toLowerCase()}`}>{entry.signal}</span></div>)}
            </section>
          </aside>
        </div>
      </div>
    </main>
  </div>;
}

function LoadingShell() {
  return <div className="app-shell"><aside className="side-rail"><div className="brand"><div className="brand-mark"><span /></div><div className="brand-copy">CROSS//SIGNAL<small>nse research cockpit</small></div></div><div className="rail-label">Workspace</div><div className="skeleton" style={{ background: 'rgba(255,255,255,.09)', margin: '4px 12px', height: 38 }} /><div className="rail-spacer" /></aside><main className="main-area"><header className="topbar"><div className="skeleton" style={{ width: 150 }} /><div className="skeleton" style={{ width: 180 }} /></header><div className="content"><div className="skeleton" style={{ height: 110, width: '58%', marginBottom: 20 }} /><div className="metric-strip">{[1, 2, 3, 4].map((item) => <div className="metric-card" key={item}><div className="skeleton" style={{ width: 90 }} /><div className="skeleton" style={{ width: 75, height: 27, marginTop: 12 }} /></div>)}</div><div className="panel"><div className="skeleton-row">{[1, 2, 3, 4, 5].map((item) => <div className="skeleton" key={item} />)}</div>{[1, 2, 3, 4, 5].map((item) => <div className="skeleton-row" key={item}>{[1, 2, 3, 4, 5].map((cell) => <div className="skeleton" key={cell} />)}</div>)}</div></div></main></div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Dashboard} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;