import React, { useEffect, useMemo, useState } from 'react';
import './ManagerDashboard.css';
import { API_ENDPOINTS } from '../../constants/api';

const API = API_ENDPOINTS.ORDERS;

function ManagerDashboard() {
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const getDateFilter = (period) => {
    const now = new Date();
    switch (period) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today.toISOString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return monthAgo.toISOString();
      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return yearAgo.toISOString();
      default:
        return null;
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/admin/all`);
        const orders = res.ok ? await res.json() : [];
        
        let filteredOrders = orders;
        if (selectedPeriod !== 'all') {
          const dateFilter = getDateFilter(selectedPeriod);
          if (dateFilter) {
            filteredOrders = orders.filter(order => {
              const orderDate = new Date(order.created_at);
              const filterDate = new Date(dateFilter);
              return orderDate >= filterDate;
            });
          }
        }
        
        const orderIds = Array.isArray(filteredOrders) ? filteredOrders.map(o => o.order_id) : [];
        const itemReqs = orderIds.map(id => fetch(`${API}?orderId=${id}`));
        const itemRes = await Promise.all(itemReqs);
        const itemJson = await Promise.all(itemRes.map(r => r.ok ? r.json() : null));
        const map = new Map();
        itemJson.forEach(entry => {
          if (!entry) return;
          const order = Array.isArray(entry) ? entry[0] : entry;
          const items = order?.items || [];
          items.forEach(it => {
            const name = it.name_product || it.name || `Товар #${it.product_id}`;
            const qty = Number(it.quantity || 0);
            const sum = Number(it.price || 0) * qty;
            if (!map.has(name)) map.set(name, { name, total_qty: 0, total_sum: 0 });
            const rec = map.get(name);
            rec.total_qty += qty;
            rec.total_sum += sum;
          });
        });
        const aggregated = Array.from(map.values()).sort((a,b)=>b.total_qty-a.total_qty).slice(0,12);
        setTopProducts(aggregated);
      } catch (e) {
        setError('Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedPeriod]);

  const totalQty = useMemo(() => topProducts.reduce((s, p) => s + p.total_qty, 0), [topProducts]);
  const maxQty = useMemo(() => Math.max(1, ...topProducts.map(p => p.total_qty)), [topProducts]);

  const getPeriodLabel = (period) => {
    switch (period) {
      case 'today': return ' (сегодня)';
      case 'week': return ' (за неделю)';
      case 'month': return ' (за месяц)';
      case 'year': return ' (за год)';
      default: return '';
    }
  };

  const exportCSV = () => {
    const header = 'Наименование;Количество;Сумма\n';
    const rows = topProducts.map(p => {
      const name = p.name || 'Неизвестный товар';
      const qty = p.total_qty || 0;
      const sum = p.total_sum || 0;
      return `${name};${qty};${sum}`;
    }).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'top-products.csv'; a.click();
    URL.revokeObjectURL(url);
  };


  if (loading) return <div className="mgr">Загрузка...</div>;
  if (error) return <div className="mgr mgr-error">{error}</div>;

  return (
    <div className="mgr">
      <h2>Панель менеджера</h2>
      <div className="mgr-actions">
        <select 
          className="mgr-select" 
          value={selectedPeriod} 
          onChange={(e) => setSelectedPeriod(e.target.value)}
        >
          <option value="all">Все время</option>
          <option value="today">Сегодня</option>
          <option value="week">За неделю</option>
          <option value="month">За месяц</option>
          <option value="year">За год</option>
        </select>
        <button className="mgr-btn" onClick={exportCSV}>Экспорт CSV</button>
      </div>

      <div id="mgr-report" className="mgr-report">
        <div className="mgr-grid">
          <div className="mgr-card">
            <h3>Большой столбчатый график: продажи (qty){getPeriodLabel(selectedPeriod)}</h3>
            <div className="mgr-bar-chart mgr-bar-chart--big">
              {topProducts.map((p, idx) => (
                <div key={idx} className="mgr-bar-item">
                  <div className="mgr-bar mgr-bar--big" style={{ width: `${(p.total_qty / maxQty) * 100}%` }} />
                  <div className="mgr-bar-label">
                    <span className="mgr-bar-name">{p.name}</span>
                    <span className="mgr-bar-value">{p.total_qty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mgr-card">
            <h3>Большая круговая диаграмма: доли продаж{getPeriodLabel(selectedPeriod)}</h3>
            <div className="mgr-pie big">
              {(() => {
                let acc = 0;
                const segments = topProducts.map((p, idx) => {
                  const frac = totalQty ? p.total_qty / totalQty : 0;
                  const start = acc; const end = acc + frac; acc = end;
                  const color = `hsl(${(idx*80)%360} 70% 50%)`;
                  return { start, end, color, name: p.name, value: Math.round(frac*100) };
                });
                const css = segments.map(s => `${s.color} ${Math.round(s.start*360)}deg ${Math.round(s.end*360)}deg`).join(', ');
                return (
                  <>
                    <div className="mgr-pie-chart" style={{ background: `conic-gradient(${css})` }} />
                    <div className="mgr-pie-legend">
                      {segments.map((s, i) => (
                        <div key={i} className="mgr-pie-row">
                          <span className="mgr-pie-dot" style={{ backgroundColor: s.color }} />
                          <span className="mgr-pie-name">{s.name}</span>
                          <span className="mgr-pie-perc">{s.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagerDashboard;


