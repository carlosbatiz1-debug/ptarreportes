// app.js - Main application logic

let activeTab = 'dashboard';
let activeDataView = {}; // tabId -> 'form' | 'history'
let chartInstances = {}; // chart id -> Chart instance

// ─── TOAST ───────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── NAVIGATION ──────────────────────────────────────────────────────
function navigateTo(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
  document.querySelectorAll('.panel').forEach(el => el.classList.toggle('active', el.id === `panel-${tabId}`));

  if (tabId === 'dashboard') renderDashboard();
  else if (tabId === 'limites') renderLimitsPanel();
  else {
    const tab = TABS.find(t => t.id === tabId);
    if (tab) renderDataPanel(tab);
  }
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────
function currentYear() { return new Date().getFullYear(); }
function currentMonth() { return new Date().getMonth() + 1; }
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1].substring(0, 3)} ${y}`;
}

// ─── DESTROY CHART HELPER ─────────────────────────────────────────────
function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

// ─── DASHBOARD ────────────────────────────────────────────────────────
function renderDashboard() {
  const stats = getGlobalStats();
  const recent = getRecentNonCompliant(30);

  // KPI Cards
  const rateColor = stats.rate === null ? 'var(--accent-blue)' :
    parseFloat(stats.rate) >= 90 ? 'var(--accent-green)' :
    parseFloat(stats.rate) >= 70 ? 'var(--accent-orange)' : 'var(--accent-red)';

  const worstParam = Object.entries(stats.paramNonCompliance || {}).sort((a,b)=>b[1]-a[1])[0];
  const worstName = worstParam ? PARAMETERS.find(p=>p.id===worstParam[0])?.name : '—';
  const worstCount = worstParam ? worstParam[1] : 0;

  const totalMonths = TABS.reduce((acc, t) => acc + getAllMonthKeys(t.id).length, 0);

  document.getElementById('kpi-rate').textContent = stats.rate !== null ? `${stats.rate}%` : '—';
  document.getElementById('kpi-rate').style.color = rateColor;
  document.getElementById('kpi-compliant').textContent = stats.compliant;
  document.getElementById('kpi-noncompliant').textContent = stats.nonCompliant;
  document.getElementById('kpi-noncompliant').style.color = stats.nonCompliant > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
  document.getElementById('kpi-months').textContent = totalMonths;
  document.getElementById('kpi-worst').textContent = worstName;
  document.getElementById('kpi-worst-count').textContent = worstCount > 0 ? `${worstCount} incumplimientos` : 'Sin incumplimientos';

  // Badge on sidebar
  document.getElementById('badge-nc').textContent = stats.nonCompliant || '';
  document.getElementById('badge-nc').style.display = stats.nonCompliant > 0 ? '' : 'none';

  // Chart 1: Non-compliant params ranking (horizontal bar)
  renderParamRankingChart(stats.paramNonCompliance);

  // Chart 2: Compliance by tab (donut)
  renderTabDonutChart(stats.tabStats);

  // Chart 3: Trend over time (line)
  renderTrendChart();

  // Chart 4: % compliance per tab (bar)
  renderTabBarChart(stats.tabStats);

  // Alert table
  renderAlertTable(recent);

  // Conditions list
  renderConditionsList();

  // Update non-compliant count on nav badges
  updateNavBadges();
}

function renderParamRankingChart(paramNonCompliance) {
  destroyChart('chart-params');
  const canvas = document.getElementById('chart-params');
  if (!canvas) return;

  const sorted = Object.entries(paramNonCompliance || {}).sort((a,b)=>b[1]-a[1]).slice(0, 15);
  if (!sorted.length) {
    canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Sin incumplimientos</div><div class="empty-text">Todos los parámetros registrados cumplen con los límites establecidos.</div></div>`;
    return;
  }

  const labels = sorted.map(([id]) => PARAMETERS.find(p=>p.id===id)?.name || id);
  const data = sorted.map(([,v]) => v);
  const colors = data.map(v => v > 5 ? 'rgba(248,81,73,0.8)' : v > 2 ? 'rgba(255,152,0,0.8)' : 'rgba(88,166,255,0.8)');

  chartInstances['chart-params'] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} incumplimiento(s)` } } },
      scales: {
        x: { grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { color: '#8b949e', stepSize: 1 } },
        y: { grid: { display: false }, ticks: { color: '#e6edf3', font: { size: 11 } } }
      }
    }
  });
}

function renderTabDonutChart(tabStats) {
  destroyChart('chart-donut');
  const canvas = document.getElementById('chart-donut');
  if (!canvas) return;

  const labels = TABS.map(t => t.name);
  const compliant = TABS.map(t => tabStats[t.id]?.compliant || 0);
  const nonCompliant = TABS.map(t => tabStats[t.id]?.nonCompliant || 0);
  const total = TABS.reduce((s, t) => s + (tabStats[t.id]?.compliant || 0) + (tabStats[t.id]?.nonCompliant || 0), 0);

  if (!total) {
    canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Sin datos</div><div class="empty-text">Registra datos para ver estadísticas.</div></div>`;
    return;
  }

  const totalNc = TABS.reduce((s, t) => s + (tabStats[t.id]?.nonCompliant || 0), 0);
  const totalC = total - totalNc;

  chartInstances['chart-donut'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Cumple', 'No Cumple'],
      datasets: [{ data: [totalC, totalNc], backgroundColor: ['rgba(63,185,80,0.8)', 'rgba(248,81,73,0.8)'], borderColor: ['#1c2333'], borderWidth: 2, hoverOffset: 4 }]
    },
    options: {
      responsive: true, cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 }, padding: 12, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed} (${total > 0 ? (ctx.parsed/total*100).toFixed(1) : 0}%)` } }
      }
    }
  });
}

function renderTrendChart() {
  destroyChart('chart-trend');
  const canvas = document.getElementById('chart-trend');
  if (!canvas) return;

  // Collect all month keys across all tabs
  const allKeys = new Set();
  const records = getAllRecords();
  for (const tab of TABS) { Object.keys(records[tab.id] || {}).forEach(k => allKeys.add(k)); }
  const sortedKeys = Array.from(allKeys).sort();

  if (sortedKeys.length < 2) {
    canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">Se necesitan más datos</div><div class="empty-text">Registra al menos 2 meses para ver la tendencia.</div></div>`;
    return;
  }

  const datasets = TABS.map(tab => {
    const data = sortedKeys.map(key => {
      const tabRecords = records[tab.id] || {};
      if (!tabRecords[key]) return null;
      let total = 0, compliant = 0;
      for (const param of PARAMETERS) {
        const entry = tabRecords[key][param.id];
        if (entry && entry.complies !== null) { total++; if (entry.complies) compliant++; }
      }
      return total > 0 ? parseFloat((compliant/total*100).toFixed(1)) : null;
    });
    return { label: tab.name, data, borderColor: tab.color, backgroundColor: tab.color+'22', borderWidth: 2, fill: false, tension: 0.4, spanGaps: true, pointRadius: 4, pointHoverRadius: 6 };
  });

  chartInstances['chart-trend'] = new Chart(canvas, {
    type: 'line',
    data: { labels: sortedKeys.map(monthLabel), datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 10 }, padding: 10, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y+'%' : 'Sin dato'}` } }
      },
      scales: {
        x: { grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { color: '#8b949e', font: { size: 10 } } },
        y: { min: 0, max: 100, grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { color: '#8b949e', callback: v => v+'%' } }
      }
    }
  });
}

function renderTabBarChart(tabStats) {
  destroyChart('chart-tabs');
  const canvas = document.getElementById('chart-tabs');
  if (!canvas) return;

  const labels = TABS.map(t => t.name.replace('Entrada ', 'Ent. ').replace('Salida ', 'Sal. '));
  const rates = TABS.map(t => tabStats[t.id]?.rate !== null ? parseFloat(tabStats[t.id]?.rate) : 0);
  const colors = rates.map(r => r >= 90 ? 'rgba(63,185,80,0.8)' : r >= 70 ? 'rgba(255,152,0,0.8)' : 'rgba(248,81,73,0.8)');

  chartInstances['chart-tabs'] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: rates, backgroundColor: colors, borderRadius: 5, borderSkipped: false }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}% cumplimiento` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 10 } } },
        y: { min: 0, max: 100, grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { color: '#8b949e', callback: v => v+'%' } }
      }
    }
  });
}

function renderAlertTable(recentNc) {
  const tbody = document.getElementById('alert-tbody');
  if (!tbody) return;
  if (!recentNc.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">✅ No hay incumplimientos recientes registrados</td></tr>`;
    return;
  }
  const limits = getLimits();
  tbody.innerHTML = recentNc.map(({ tab, key, param, value }) => {
    const limit = limits[param.id] || {};
    const limitStr = param.type === 'boolean' ? 'Ausente' :
      [limit.min != null && limit.min !== '' ? `Min: ${limit.min}` : '', limit.max != null && limit.max !== '' ? `Máx: ${limit.max}` : ''].filter(Boolean).join(' / ') || '—';
    return `<tr>
      <td><span class="badge" style="background:${tab.color}20;color:${tab.color};border:1px solid ${tab.color}40">${tab.name}</span></td>
      <td>${monthLabel(key)}</td>
      <td class="param-name">${param.name}</td>
      <td style="font-weight:600;color:var(--accent-red)">${value ?? '—'}${param.unit ? ' '+param.unit : ''}</td>
      <td style="color:var(--text-muted);font-size:11px">${limitStr}</td>
    </tr>`;
  }).join('');
}

// ─── CONDITIONS MODAL ─────────────────────────────────────────────────
let _condYear = null, _condMonth = null;

function openConditionsModal(tabId) {
  const yearSel = document.getElementById(`year-${tabId}`);
  const monthSel = document.getElementById(`month-${tabId}`);
  _condYear = parseInt(yearSel.value);
  _condMonth = parseInt(monthSel.value);
  const period = `${MONTH_NAMES[_condMonth - 1]} ${_condYear}`;
  document.getElementById('modal-conditions-period').textContent = period;
  const existing = getCondition(_condYear, _condMonth);
  document.getElementById('modal-conditions-text').value = existing ? existing.text : '';
  document.getElementById('modal-conditions').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-conditions-text').focus(), 100);
}

function closeConditionsModal(e) {
  if (e && e.target !== document.getElementById('modal-conditions')) return;
  document.getElementById('modal-conditions').style.display = 'none';
}

function saveConditionsModal() {
  if (_condYear === null || _condMonth === null) return;
  const text = document.getElementById('modal-conditions-text').value.trim();
  saveCondition(_condYear, _condMonth, text);
  document.getElementById('modal-conditions').style.display = 'none';
  showToast(`Condiciones guardadas: ${MONTH_NAMES[_condMonth-1]} ${_condYear}`, 'success');
  if (activeTab === 'dashboard') renderConditionsList();
}

function deleteConditionItem(year, month) {
  if (!confirm(`¿Eliminar las condiciones especiales de ${MONTH_NAMES[month-1]} ${year}?`)) return;
  deleteCondition(year, month);
  showToast('Condición eliminada', 'success');
  if (activeTab === 'dashboard') renderConditionsList();
}

function editConditionItem(year, month) {
  _condYear = year; _condMonth = month;
  document.getElementById('modal-conditions-period').textContent = `${MONTH_NAMES[month - 1]} ${year}`;
  const existing = getCondition(year, month);
  document.getElementById('modal-conditions-text').value = existing ? existing.text : '';
  document.getElementById('modal-conditions').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-conditions-text').focus(), 100);
}

function renderConditionsList() {
  const container = document.getElementById('conditions-dashboard-list');
  if (!container) return;
  const all = getAllConditions();
  const keys = Object.keys(all).sort().reverse();

  if (!keys.length) {
    container.innerHTML = `<div class="empty-state" style="padding:32px">
      <div class="empty-icon" style="font-size:36px">📋</div>
      <div class="empty-title">Sin condiciones registradas</div>
      <div class="empty-text">Ve a la pestaña Mezcla y usa el botón "Condiciones Especiales" para registrar observaciones mensuales.</div>
    </div>`;
    return;
  }

  container.innerHTML = keys.map(key => {
    const [y, m] = key.split('-');
    const year = parseInt(y), month = parseInt(m);
    const entry = all[key];
    const savedDate = entry.savedAt
      ? new Date(entry.savedAt).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'})
      : '';
    return `<div class="condition-item">
      <div class="condition-month">${MONTH_NAMES[month-1].substring(0,3)}<br>${year}</div>
      <div class="condition-text">${entry.text.replace(/\n/g,'<br>')}
        <span style="font-size:10px;color:var(--text-muted);margin-top:4px;display:block">Registrado: ${savedDate}</span>
      </div>
      <div class="condition-actions">
        <button class="btn-icon" onclick="editConditionItem(${year},${month})" title="Editar">✏</button>
        <button class="btn-icon del" onclick="deleteConditionItem(${year},${month})" title="Eliminar">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ─── DATA PANEL ───────────────────────────────────────────────────────
function renderDataPanel(tab) {
  const view = activeDataView[tab.id] || 'form';
  document.getElementById(`view-form-${tab.id}`).classList.toggle('active', view === 'form');
  document.getElementById(`view-history-${tab.id}`).classList.toggle('active', view === 'history');

  if (view === 'form') renderDataForm(tab);
  else renderHistoryTable(tab);
}

function renderDataForm(tab) {
  const yearSel = document.getElementById(`year-${tab.id}`);
  const monthSel = document.getElementById(`month-${tab.id}`);
  const year = parseInt(yearSel.value);
  const month = parseInt(monthSel.value);
  const existingRecord = getMonthRecord(tab.id, year, month);
  const limits = getLimits();

  const tbody = document.getElementById(`tbody-${tab.id}`);
  if (!tbody) return;

  let totalMeasured = 0, totalCompliant = 0, totalNc = 0;
  if (existingRecord) {
    for (const p of PARAMETERS) {
      const e = existingRecord[p.id];
      if (e && e.complies !== null) { totalMeasured++; if (e.complies) totalCompliant++; else totalNc++; }
    }
  }

  // Update summary bar
  const sb = document.getElementById(`summary-${tab.id}`);
  if (sb) {
    const rate = totalMeasured > 0 ? (totalCompliant/totalMeasured*100).toFixed(1) : null;
    sb.innerHTML = `
      <div class="summary-item"><span class="summary-label">Medidos</span><span class="summary-value" style="color:var(--accent-blue)">${totalMeasured}</span></div>
      <div class="summary-item"><span class="summary-label">Cumplen</span><span class="summary-value" style="color:var(--accent-green)">${totalCompliant}</span></div>
      <div class="summary-item"><span class="summary-label">No Cumplen</span><span class="summary-value" style="color:${totalNc>0?'var(--accent-red)':'var(--text-muted)'}">${totalNc}</span></div>
      <div class="summary-item"><span class="summary-label">% Cumplimiento</span><span class="summary-value" style="color:${rate===null?'var(--text-muted)':parseFloat(rate)>=90?'var(--accent-green)':parseFloat(rate)>=70?'var(--accent-orange)':'var(--accent-red)'}">${rate !== null ? rate+'%' : '—'}</span></div>
    `;
  }

  tbody.innerHTML = PARAMETERS.map(param => {
    const entry = existingRecord?.[param.id];
    const val = entry?.value ?? '';
    const complies = entry?.complies;
    const limit = limits[param.id] || {};
    const hasMin = limit.min !== null && limit.min !== undefined && limit.min !== '';
    const hasMax = limit.max !== null && limit.max !== undefined && limit.max !== '';
    const limitStr = param.type === 'boolean' ? 'Ausente' :
      [hasMin ? `Min: ${limit.min}` : '', hasMax ? `Máx: ${limit.max}` : ''].filter(Boolean).join(' / ') || '<span style="color:var(--accent-orange);font-size:10px">Sin límite</span>';

    let ciHtml = '';
    let rowClass = '';
    if (val === '' || val === null) {
      ciHtml = `<span class="ci no-data"><span class="ci-dot"></span>Sin dato</span>`;
    } else if (complies === null) {
      ciHtml = `<span class="ci no-limit"><span class="ci-dot"></span>Sin límite</span>`;
    } else if (complies) {
      ciHtml = `<span class="ci ok"><span class="ci-dot"></span>Cumple</span>`;
    } else {
      ciHtml = `<span class="ci nc"><span class="ci-dot"></span>No Cumple</span>`;
      rowClass = 'row-nc';
    }

    const inputHtml = param.type === 'boolean'
      ? `<select class="value-select ${complies===false?'nc':complies===true?'ok':''}" id="inp-${tab.id}-${param.id}" onchange="onValueChange('${tab.id}','${param.id}',this.value)">
           <option value="" ${!val?'selected':''}>— No medido —</option>
           <option value="ausente" ${val==='ausente'?'selected':''}>Ausente ✓</option>
           <option value="presente" ${val==='presente'?'selected':''}>Presente ✗</option>
         </select>`
      : `<input type="number" step="any" class="value-input ${complies===false?'nc':complies===true?'ok':''}" id="inp-${tab.id}-${param.id}" value="${val}" placeholder="—" onchange="onValueChange('${tab.id}','${param.id}',this.value)" oninput="onValueChange('${tab.id}','${param.id}',this.value)">`;

    return `<tr class="${rowClass}" id="row-${tab.id}-${param.id}">
      <td><span class="param-name">${param.name}</span></td>
      <td><span class="param-unit">${param.unit || '—'}</span></td>
      <td style="font-size:12px;color:var(--text-secondary)">${limitStr}</td>
      <td>${inputHtml}</td>
      <td id="ci-${tab.id}-${param.id}">${ciHtml}</td>
    </tr>`;
  }).join('');
}

function onValueChange(tabId, paramId, rawVal) {
  const param = PARAMETERS.find(p => p.id === paramId);
  const limits = getLimits();
  const complies = checkCompliance(param, rawVal, limits);

  const inp = document.getElementById(`inp-${tabId}-${paramId}`);
  const ciEl = document.getElementById(`ci-${tabId}-${paramId}`);
  const rowEl = document.getElementById(`row-${tabId}-${paramId}`);

  if (inp) {
    inp.className = inp.tagName === 'SELECT' ? `value-select ${complies===false?'nc':complies===true?'ok':''}` : `value-input ${complies===false?'nc':complies===true?'ok':''}`;
  }

  const val = rawVal === '' || rawVal === null ? null : rawVal;
  let ciHtml = '';
  if (!val && val !== 0) ciHtml = `<span class="ci no-data"><span class="ci-dot"></span>Sin dato</span>`;
  else if (complies === null) ciHtml = `<span class="ci no-limit"><span class="ci-dot"></span>Sin límite</span>`;
  else if (complies) ciHtml = `<span class="ci ok"><span class="ci-dot"></span>Cumple</span>`;
  else ciHtml = `<span class="ci nc"><span class="ci-dot"></span>No Cumple</span>`;

  if (ciEl) ciEl.innerHTML = ciHtml;
  if (rowEl) rowEl.className = complies === false ? 'row-nc' : '';
}

function saveDataForm(tabId) {
  const yearSel = document.getElementById(`year-${tabId}`);
  const monthSel = document.getElementById(`month-${tabId}`);
  const year = parseInt(yearSel.value);
  const month = parseInt(monthSel.value);

  const rawValues = {};
  for (const param of PARAMETERS) {
    const inp = document.getElementById(`inp-${tabId}-${param.id}`);
    rawValues[param.id] = inp ? (inp.value === '' ? null : inp.value) : null;
  }

  saveMonthRecord(tabId, year, month, rawValues);
  showToast(`Datos guardados para ${MONTH_NAMES[month-1]} ${year}`, 'success');

  const tab = TABS.find(t => t.id === tabId);
  renderDataForm(tab);
  updateNavBadges();
}

function renderHistoryTable(tab) {
  const keys = getAllMonthKeys(tab.id);
  const container = document.getElementById(`history-${tab.id}`);
  if (!container) return;

  if (!keys.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">Sin histórico</div><div class="empty-text">Aún no hay registros guardados para ${tab.name}.</div></div>`;
    return;
  }

  const records = getAllRecords();

  // Build summary per month
  let html = `<div class="table-card"><div class="table-card-header"><span class="table-card-title">Histórico de Registros — ${tab.name}</span><button class="btn btn-secondary btn-sm" onclick="exportCSV('${tab.id}')">⬇ Exportar CSV</button></div>
  <div style="overflow-x:auto"><table class="data-table"><thead><tr>
    <th>Mes / Año</th>
    <th>Medidos</th>
    <th>Cumplen ✓</th>
    <th>No Cumplen ✗</th>
    <th>% Cumplimiento</th>
    <th>Parámetros Incumplidos</th>
  </tr></thead><tbody>`;

  for (const key of keys.slice().reverse()) {
    const data = records[tab.id][key];
    let total = 0, compliant = 0, nc = 0;
    const ncParams = [];
    for (const param of PARAMETERS) {
      const e = data[param.id];
      if (e && e.complies !== null) { total++; if (e.complies) compliant++; else { nc++; ncParams.push(param.name); } }
    }
    const rate = total > 0 ? (compliant/total*100).toFixed(1) : null;
    const rateColor = rate === null ? 'var(--text-muted)' : parseFloat(rate) >= 90 ? 'var(--accent-green)' : parseFloat(rate) >= 70 ? 'var(--accent-orange)' : 'var(--accent-red)';

    html += `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${monthLabel(key)}</td>
      <td>${total}</td>
      <td style="color:var(--accent-green)">${compliant}</td>
      <td style="color:${nc>0?'var(--accent-red)':'var(--text-muted)'};font-weight:${nc>0?'600':'400'}">${nc}</td>
      <td><span style="font-weight:700;color:${rateColor}">${rate !== null ? rate+'%' : '—'}</span></td>
      <td style="font-size:11px;color:var(--accent-red);max-width:300px">${ncParams.length ? ncParams.join(', ') : '<span style="color:var(--accent-green)">Todos cumplen ✓</span>'}</td>
    </tr>`;
  }

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
}

// ─── LIMITS PANEL ─────────────────────────────────────────────────────
function renderLimitsPanel() {
  const limits = getLimits();
  const container = document.getElementById('limits-grid');
  if (!container) return;

  container.innerHTML = PARAMETERS.map(param => {
    if (param.type === 'boolean') {
      return `<div class="limit-card">
        <div class="limit-card-name">${param.name}</div>
        <div class="limit-card-unit">Tipo: Presente / Ausente</div>
        <div style="font-size:11px;color:var(--accent-orange);margin-top:4px">⚠ Presente = No Cumple (automático)</div>
      </div>`;
    }
    const l = limits[param.id] || {};
    return `<div class="limit-card">
      <div class="limit-card-name">${param.name}</div>
      <div class="limit-card-unit">${param.unit || 'Sin unidad'}</div>
      <div class="limit-inputs">
        <div class="limit-input-group">
          <span class="limit-input-label">Mínimo</span>
          <input type="number" step="any" class="limit-input" id="lmin-${param.id}" value="${l.min ?? ''}" placeholder="Sin mín.">
        </div>
        <div class="limit-input-group">
          <span class="limit-input-label">Máximo</span>
          <input type="number" step="any" class="limit-input" id="lmax-${param.id}" value="${l.max ?? ''}" placeholder="Sin máx.">
        </div>
      </div>
    </div>`;
  }).join('');
}

function saveLimitsForm() {
  const limits = {};
  for (const param of PARAMETERS) {
    if (param.type === 'boolean') continue;
    const minEl = document.getElementById(`lmin-${param.id}`);
    const maxEl = document.getElementById(`lmax-${param.id}`);
    limits[param.id] = {
      min: minEl?.value !== '' ? minEl.value : null,
      max: maxEl?.value !== '' ? maxEl.value : null
    };
  }
  saveLimits(limits);
  showToast('Límites guardados correctamente', 'success');
  // Recalculate compliance for all existing records
  recalculateAllCompliance();
}

function recalculateAllCompliance() {
  const records = getAllRecords();
  const limits = getLimits();
  for (const tabId of Object.keys(records)) {
    for (const key of Object.keys(records[tabId])) {
      const monthData = records[tabId][key];
      for (const param of PARAMETERS) {
        const entry = monthData[param.id];
        if (entry && entry.value !== null) {
          entry.complies = checkCompliance(param, entry.value, limits);
        }
      }
    }
  }
  saveAllRecords(records);
}

// ─── NAV BADGES ───────────────────────────────────────────────────────
function updateNavBadges() {
  const stats = getGlobalStats();
  const badge = document.getElementById('badge-nc');
  if (badge) {
    badge.textContent = stats.nonCompliant || '';
    badge.style.display = stats.nonCompliant > 0 ? '' : 'none';
  }
  for (const tab of TABS) {
    const b = document.getElementById(`badge-${tab.id}`);
    if (!b) continue;
    const s = stats.tabStats[tab.id] || {};
    b.textContent = s.nonCompliant || '';
    b.style.display = s.nonCompliant > 0 ? '' : 'none';
  }
}

// ─── YEAR OPTIONS HELPER ──────────────────────────────────────────────
function buildYearOptions(selId, tabId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const curY = currentYear();
  const keys = getAllMonthKeys(tabId);
  const years = new Set([curY, curY - 1, curY - 2]);
  keys.forEach(k => years.add(parseInt(k.split('-')[0])));
  const sorted = Array.from(years).sort((a,b) => b - a);
  const curVal = parseInt(sel.value) || curY;
  sel.innerHTML = sorted.map(y => `<option value="${y}" ${y === curVal ? 'selected' : ''}>${y}</option>`).join('');
}

// ─── INIT ─────────────────────────────────────────────────────────────
function init() {
  // Build year dropdowns for all tabs
  for (const tab of TABS) {
    buildYearOptions(`year-${tab.id}`, tab.id);
  }
  // Set current month
  for (const tab of TABS) {
    const ms = document.getElementById(`month-${tab.id}`);
    if (ms) ms.value = currentMonth();
  }
  navigateTo('dashboard');
}

window.addEventListener('DOMContentLoaded', init);

// ─── PRINT / PDF REPORT ───────────────────────────────────────────────
function printDashboardReport() {
  const stats = getGlobalStats();
  const recent = getRecentNonCompliant(100);
  const limits = getLimits();
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  const totalMonths = TABS.reduce((acc, t) => acc + getAllMonthKeys(t.id).length, 0);
  const worstParam = Object.entries(stats.paramNonCompliance || {}).sort((a,b)=>b[1]-a[1])[0];
  const worstName = worstParam ? PARAMETERS.find(p=>p.id===worstParam[0])?.name : 'Ninguno';
  const worstCount = worstParam ? worstParam[1] : 0;
  const rateNum = stats.rate !== null ? parseFloat(stats.rate) : null;
  const rateColor = rateNum === null ? '#555' : rateNum >= 90 ? '#27ae60' : rateNum >= 70 ? '#e67e22' : '#c0392b';

  // --- Top non-compliant params table ---
  const topParams = Object.entries(stats.paramNonCompliance || {})
    .sort((a,b)=>b[1]-a[1]).slice(0, 15);
  const topParamsRows = topParams.length ? topParams.map(([id, count]) => {
    const p = PARAMETERS.find(x=>x.id===id);
    const pct = stats.total > 0 ? ((count / (stats.total / PARAMETERS.length))*100).toFixed(0) : 0;
    const barColor = count > 5 ? '#c0392b' : count > 2 ? '#e67e22' : '#2980b9';
    return `<tr>
      <td style="font-weight:600;padding:7px 10px">${p?.name || id}</td>
      <td style="text-align:center;padding:7px 10px;color:${barColor};font-weight:700">${count}</td>
      <td style="padding:7px 10px">
        <div style="background:#eee;border-radius:3px;height:8px;width:140px;display:inline-block;vertical-align:middle">
          <div style="background:${barColor};height:8px;border-radius:3px;width:${Math.min(100,count * 12)}px"></div>
        </div>
      </td>
      <td style="text-align:center;padding:7px 10px;font-size:11px;color:#555">${p?.unit || '—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="4" style="text-align:center;padding:20px;color:#aaa">✅ Sin incumplimientos registrados</td></tr>`;

  // --- Category stats table ---
  const catRows = TABS.map(tab => {
    const s = stats.tabStats[tab.id] || {};
    const r = s.rate !== null ? parseFloat(s.rate) : null;
    const rc = r === null ? '#999' : r >= 90 ? '#27ae60' : r >= 70 ? '#e67e22' : '#c0392b';
    return `<tr>
      <td style="padding:7px 12px;font-weight:600">${tab.name}</td>
      <td style="padding:7px 12px;text-align:center">${s.total || 0}</td>
      <td style="padding:7px 12px;text-align:center;color:#27ae60;font-weight:600">${s.compliant || 0}</td>
      <td style="padding:7px 12px;text-align:center;color:${(s.nonCompliant||0)>0?'#c0392b':'#aaa'};font-weight:${(s.nonCompliant||0)>0?'700':'400'}">${s.nonCompliant || 0}</td>
      <td style="padding:7px 12px;text-align:center;font-weight:700;color:${rc}">${r !== null ? r+'%' : '—'}</td>
    </tr>`;
  }).join('');

  // --- Alerts table ---
  const alertRows = recent.length ? recent.map(({ tab, key, param, value }) => {
    const limit = limits[param.id] || {};
    const limitStr = param.type === 'boolean' ? 'Ausente' :
      [limit.min != null && limit.min !== '' ? `Mín: ${limit.min}` : '',
       limit.max != null && limit.max !== '' ? `Máx: ${limit.max}` : ''].filter(Boolean).join(' / ') || '—';
    return `<tr>
      <td style="padding:6px 10px;font-weight:600">${tab.name}</td>
      <td style="padding:6px 10px">${monthLabel(key)}</td>
      <td style="padding:6px 10px;font-weight:600">${param.name}</td>
      <td style="padding:6px 10px;color:#c0392b;font-weight:700">${value ?? '—'}${param.unit ? ' '+param.unit : ''}</td>
      <td style="padding:6px 10px;color:#555;font-size:11px">${limitStr}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" style="text-align:center;padding:20px;color:#aaa">✅ No hay incumplimientos registrados</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte PTAR — ${dateStr}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',Arial,sans-serif; color:#1a1a2e; background:#fff; font-size:12px; }

    .report-header { background:linear-gradient(135deg,#0f3460,#16213e); color:#fff; padding:28px 36px; display:flex; justify-content:space-between; align-items:flex-start; }
    .report-logo { font-size:28px; margin-bottom:6px; }
    .report-title { font-size:22px; font-weight:800; letter-spacing:-.02em; }
    .report-subtitle { font-size:12px; opacity:.7; margin-top:3px; }
    .report-meta { text-align:right; font-size:11px; opacity:.75; line-height:1.8; }
    .report-meta strong { font-size:13px; opacity:1; display:block; margin-bottom:4px; }

    .section { padding:22px 36px; border-bottom:1px solid #eee; }
    .section-title { font-size:14px; font-weight:700; color:#0f3460; margin-bottom:14px; display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:.05em; }
    .section-title::after { content:''; flex:1; height:1px; background:linear-gradient(to right,#0f3460,transparent); }

    .kpi-row { display:flex; gap:12px; }
    .kpi-box { flex:1; border:1px solid #e0e0e0; border-radius:8px; padding:14px 16px; position:relative; overflow:hidden; }
    .kpi-box::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--c,#0f3460); }
    .kpi-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#888; margin-bottom:6px; }
    .kpi-val { font-size:26px; font-weight:800; letter-spacing:-.02em; color:var(--c,#1a1a2e); }
    .kpi-desc { font-size:10px; color:#aaa; margin-top:3px; }

    table { width:100%; border-collapse:collapse; font-size:12px; }
    thead th { background:#0f3460; color:#fff; padding:8px 10px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; }
    tbody tr { border-bottom:1px solid #f0f0f0; }
    tbody tr:nth-child(even) { background:#fafafa; }
    tbody tr.nc-row { background:#fff5f5; }

    .badge-nc { display:inline-block; background:#fde8e8; color:#c0392b; border:1px solid #f5c6c6; padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700; }
    .badge-ok { display:inline-block; background:#e8f8ed; color:#27ae60; border:1px solid #b2dfcb; padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700; }

    .footer { background:#f8f8f8; padding:14px 36px; display:flex; justify-content:space-between; font-size:10px; color:#aaa; border-top:1px solid #e0e0e0; }

    .alert-box { background:#fff5f5; border:1px solid #f5c6c6; border-left:4px solid #c0392b; border-radius:6px; padding:12px 16px; margin-bottom:16px; font-size:12px; color:#c0392b; }
    .ok-box { background:#f0faf4; border:1px solid #b2dfcb; border-left:4px solid #27ae60; border-radius:6px; padding:12px 16px; margin-bottom:16px; font-size:12px; color:#27ae60; }

    @media print {
      body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      .no-print { display:none; }
      .section { page-break-inside:avoid; }
      table { page-break-inside:auto; }
      tr { page-break-inside:avoid; }
    }
  </style>
</head>
<body>

<!-- HEADER -->
<div class="report-header">
  <div>
    <div class="report-logo">💧</div>
    <div class="report-title">Reporte de Cumplimiento</div>
    <div class="report-subtitle">Genomma Lab · Planta San Cayetano — Planta de Tratamiento de Aguas Residuales</div>
  </div>
  <div class="report-meta">
    <strong>Generado:</strong>
    ${dateStr}<br>
    ${timeStr} hrs<br><br>
    Tipo: Dashboard General<br>
    Clasificación: Interno
  </div>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="section">
  <div class="section-title">Resumen Ejecutivo</div>
  ${stats.nonCompliant > 0
    ? `<div class="alert-box">⚠ Se detectaron <strong>${stats.nonCompliant} incumplimientos</strong> en el histórico acumulado. El parámetro con más incumplimientos es <strong>${worstName}</strong> (${worstCount} veces). Se requiere atención.</div>`
    : `<div class="ok-box">✓ Todos los parámetros registrados con límites configurados cumplen con los valores establecidos.</div>`
  }
  <div class="kpi-row">
    <div class="kpi-box" style="--c:${rateColor}">
      <div class="kpi-lbl">% Cumplimiento Global</div>
      <div class="kpi-val">${stats.rate !== null ? stats.rate+'%' : '—'}</div>
      <div class="kpi-desc">De todos los parámetros medidos</div>
    </div>
    <div class="kpi-box" style="--c:#27ae60">
      <div class="kpi-lbl">Cumplen</div>
      <div class="kpi-val">${stats.compliant}</div>
      <div class="kpi-desc">Total histórico acumulado</div>
    </div>
    <div class="kpi-box" style="--c:${stats.nonCompliant>0?'#c0392b':'#27ae60'}">
      <div class="kpi-lbl">No Cumplen</div>
      <div class="kpi-val">${stats.nonCompliant}</div>
      <div class="kpi-desc">Requieren atención</div>
    </div>
    <div class="kpi-box" style="--c:#7f52bf">
      <div class="kpi-lbl">Meses Registrados</div>
      <div class="kpi-val">${totalMonths}</div>
      <div class="kpi-desc">En todos los tipos de muestra</div>
    </div>
    <div class="kpi-box" style="--c:#c0392b">
      <div class="kpi-lbl">Parámetro Crítico</div>
      <div class="kpi-val" style="font-size:14px;margin-top:4px">${worstName}</div>
      <div class="kpi-desc">${worstCount > 0 ? worstCount+' incumplimientos' : 'Sin incumplimientos'}</div>
    </div>
  </div>
</div>

<!-- CUMPLIMIENTO POR CATEGORÍA -->
<div class="section">
  <div class="section-title">Cumplimiento por Tipo de Muestra</div>
  <table>
    <thead><tr>
      <th>Tipo de Muestra</th>
      <th style="text-align:center">Total Medidos</th>
      <th style="text-align:center">Cumplen ✓</th>
      <th style="text-align:center">No Cumplen ✗</th>
      <th style="text-align:center">% Cumplimiento</th>
    </tr></thead>
    <tbody>${catRows}</tbody>
  </table>
</div>

<!-- PARÁMETROS CON MÁS INCUMPLIMIENTOS -->
<div class="section">
  <div class="section-title">Parámetros con más Incumplimientos (Top 15)</div>
  <table>
    <thead><tr>
      <th>Parámetro</th>
      <th style="text-align:center">Incumplimientos</th>
      <th>Frecuencia</th>
      <th style="text-align:center">Unidad</th>
    </tr></thead>
    <tbody>${topParamsRows}</tbody>
  </table>
</div>

<!-- TABLA DE INCUMPLIMIENTOS -->
<div class="section">
  <div class="section-title">Detalle de Incumplimientos Detectados</div>
  <table>
    <thead><tr>
      <th>Tipo de Muestra</th>
      <th>Periodo</th>
      <th>Parámetro</th>
      <th>Valor Medido</th>
      <th>Límite Permisible</th>
    </tr></thead>
    <tbody>${alertRows}</tbody>
  </table>
</div>

<!-- FOOTER -->
<div class="footer">
  <span>Genomma Lab · Planta San Cayetano — PTAR Sistema de Resultados</span>
  <span>Reporte generado el ${dateStr} a las ${timeStr} hrs</span>
  <span>Datos almacenados localmente · Confidencial</span>
</div>

<script>
  window.onload = function() {
    setTimeout(() => { window.print(); }, 400);
  };
<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes');
  if (!win) { showToast('Permite ventanas emergentes para generar el reporte', 'error'); return; }
  win.document.write(html);
  win.document.close();
}

