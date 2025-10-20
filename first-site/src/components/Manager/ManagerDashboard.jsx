import React, { useEffect, useMemo, useState } from 'react';
import './ManagerDashboard.css';

const API = 'http://localhost:5000/api';

function ManagerDashboard() {
  const [topProducts, setTopProducts] = useState([]); // {name, total_qty, total_sum}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Берём реальные заказы и агрегируем позиции
        const res = await fetch(`${API}/orders/admin/all`);
        const orders = res.ok ? await res.json() : [];
        const orderIds = Array.isArray(orders) ? orders.map(o => o.order_id) : [];
        const itemReqs = orderIds.map(id => fetch(`${API}/orders?orderId=${id}`));
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
  }, []);

  const totalQty = useMemo(() => topProducts.reduce((s, p) => s + p.total_qty, 0), [topProducts]);
  const maxQty = useMemo(() => Math.max(1, ...topProducts.map(p => p.total_qty)), [topProducts]);

  const exportCSV = () => {
    const header = 'Наименование;Количество;Сумма\n';
    const rows = topProducts.map(p => {
      const name = p.name || 'Неизвестный товар';
      const qty = p.total_qty || 0;
      const sum = p.total_sum || 0;
      return `${name};${qty};${sum}`;
    }).join('\n');
    // Добавляем BOM для правильного отображения кириллицы в Excel
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
        <button className="mgr-btn" onClick={exportCSV}>Экспорт CSV</button>
      </div>

      <div id="mgr-report" className="mgr-report">
        <div className="mgr-grid">
          <div className="mgr-card">
            <h3>Большой столбчатый график: продажи (qty)</h3>
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
            <h3>Большая круговая диаграмма: доли продаж</h3>
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


