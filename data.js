// data.js
const PARAMETERS = [
  { id: 'arsenico', name: 'Arsénico', type: 'numeric', unit: 'mg/L' },
  { id: 'cadmio', name: 'Cadmio', type: 'numeric', unit: 'mg/L' },
  { id: 'cloruros', name: 'Cloruros', type: 'numeric', unit: 'mg/L' },
  { id: 'cobre', name: 'Cobre', type: 'numeric', unit: 'mg/L' },
  { id: 'conductividad', name: 'Conductividad Eléctrica', type: 'numeric', unit: 'µS/cm' },
  { id: 'cromo_total', name: 'Cromo Total', type: 'numeric', unit: 'mg/L' },
  { id: 'db05', name: 'DB05', type: 'numeric', unit: 'mg/L' },
  { id: 'dqo', name: 'DQO', type: 'numeric', unit: 'mg/L' },
  { id: 'e_coli', name: 'E. coli', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'e_coli_2', name: 'E. coli 2', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'e_coli_3', name: 'E. coli 3', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'e_coli_3b', name: 'E. coli 3 (bis)', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'e_coli_4', name: 'E. coli 4', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'e_coli_5', name: 'E. coli 5', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'e_coli_6', name: 'E. coli 6', type: 'numeric', unit: 'NMP/100mL' },
  { id: 'fenoles', name: 'Fenoles', type: 'numeric', unit: 'mg/L' },
  { id: 'huevos_helminto', name: 'Huevos de Helminto', type: 'numeric', unit: 'huevos/L' },
  { id: 'manganeso', name: 'Manganeso', type: 'numeric', unit: 'mg/L' },
  { id: 'material_flotante', name: 'Material Flotante', type: 'boolean', unit: '' },
  { id: 'mercurio', name: 'Mercurio', type: 'numeric', unit: 'mg/L' },
  { id: 'niquel', name: 'Níquel', type: 'numeric', unit: 'mg/L' },
  { id: 'nitrogeno_nitratos_1', name: 'Nitrógeno de Nitratos 1', type: 'numeric', unit: 'mg/L' },
  { id: 'nitrogeno_nitratos_2', name: 'Nitrógeno de Nitratos 2', type: 'numeric', unit: 'mg/L' },
  { id: 'nitrogeno_total', name: 'Nitrógeno Total', type: 'numeric', unit: 'mg/L' },
  { id: 'nitrogeno_kjeldahl', name: 'Nitrógeno Total Kjeldahl', type: 'numeric', unit: 'mg/L' },
  { id: 'ph', name: 'PH', type: 'numeric', unit: '' },
  { id: 'plomo', name: 'Plomo', type: 'numeric', unit: 'mg/L' },
  { id: 'solidos_sedimentables', name: 'Sólidos Sedimentables', type: 'numeric', unit: 'mL/L' },
  { id: 'solidos_suspendidos', name: 'Sólidos Suspendidos Totales', type: 'numeric', unit: 'mg/L' },
  { id: 'temperatura', name: 'Temperatura', type: 'numeric', unit: '°C' },
  { id: 'zinc', name: 'Zinc', type: 'numeric', unit: 'mg/L' },
];

const TABS = [
  { id: 'entrada_quimica', name: 'Entrada Química', color: '#58a6ff' },
  { id: 'salida_quimica', name: 'Salida Química', color: '#3fb950' },
  { id: 'entrada_biologica', name: 'Entrada Biológica', color: '#ff9800' },
  { id: 'salida_biologica', name: 'Salida Biológica', color: '#bc8cff' },
  { id: 'mezcla', name: 'Mezcla', color: '#e3b341' },
];

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const STORAGE = { RECORDS: 'wtp_records_v2', LIMITS: 'wtp_limits_v2', CONDITIONS: 'wtp_conditions_v1' };

function getLimits() { try { return JSON.parse(localStorage.getItem(STORAGE.LIMITS)) || {}; } catch { return {}; } }
function saveLimits(l) { localStorage.setItem(STORAGE.LIMITS, JSON.stringify(l)); }
function getAllRecords() { try { return JSON.parse(localStorage.getItem(STORAGE.RECORDS)) || {}; } catch { return {}; } }
function saveAllRecords(r) { localStorage.setItem(STORAGE.RECORDS, JSON.stringify(r)); }
function getMonthRecord(tabId, year, month) { const k=`${year}-${String(month).padStart(2,'0')}`; return getAllRecords()[tabId]?.[k]||null; }
function getAllConditions() { try { return JSON.parse(localStorage.getItem(STORAGE.CONDITIONS)) || {}; } catch { return {}; } }
function getCondition(y,m) { return getAllConditions()[`${y}-${String(m).padStart(2,'0')}`]||null; }
function saveCondition(y,m,text) { const all=getAllConditions(), k=`${y}-${String(m).padStart(2,'0')}`; if(text&&text.trim()) all[k]={text:text.trim(),savedAt:new Date().toISOString()}; else delete all[k]; localStorage.setItem(STORAGE.CONDITIONS,JSON.stringify(all)); }
function deleteCondition(y,m) { const all=getAllConditions(); delete all[`${y}-${String(m).padStart(2,'0')}`]; localStorage.setItem(STORAGE.CONDITIONS,JSON.stringify(all)); }

function checkCompliance(param, val, limits) {
  if (val===null||val===undefined||val==='') return null;
  if (param.type==='boolean') return String(val).toLowerCase()!=='presente';
  const n=parseFloat(val); if(isNaN(n)) return null;
  const l=limits[param.id]||{};
  const hasMin=l.min!=null&&l.min!=='', hasMax=l.max!=null&&l.max!=='';
  if(!hasMin&&!hasMax) return null;
  let ok=true;
  if(hasMax&&n>parseFloat(l.max)) ok=false;
  if(hasMin&&n<parseFloat(l.min)) ok=false;
  return ok;
}

function saveMonthRecord(tabId, year, month, raw) {
  const records=getAllRecords(); if(!records[tabId]) records[tabId]={};
  const k=`${year}-${String(month).padStart(2,'0')}`, limits=getLimits(), result={};
  for(const p of PARAMETERS) { const v=raw[p.id], has=v!=null&&v!==''; result[p.id]={value:has?v:null,complies:checkCompliance(p,v,limits)}; }
  records[tabId][k]=result; saveAllRecords(records); return result;
}

function getAllMonthKeys(tabId) { return Object.keys(getAllRecords()[tabId]||{}).sort(); }

function getGlobalStats() {
  const records=getAllRecords(); let total=0,compliant=0,nonCompliant=0; const tabStats={},paramNonCompliance={};
  for(const tab of TABS) {
    const tr=records[tab.id]||{}; let tT=0,tC=0,tN=0;
    for(const k of Object.keys(tr)) for(const p of PARAMETERS) { const e=tr[k]?.[p.id]; if(e&&e.complies!==null){tT++;total++;if(e.complies){tC++;compliant++;}else{tN++;nonCompliant++;paramNonCompliance[p.id]=(paramNonCompliance[p.id]||0)+1;}} }
    tabStats[tab.id]={total:tT,compliant:tC,nonCompliant:tN,rate:tT>0?(tC/tT*100).toFixed(1):null};
  }
  return {total,compliant,nonCompliant,rate:total>0?(compliant/total*100).toFixed(1):null,tabStats,paramNonCompliance};
}

function getRecentNonCompliant(limit=20) {
  const records=getAllRecords(), results=[];
  for(const tab of TABS) { const tr=records[tab.id]||{}; for(const k of Object.keys(tr).sort().reverse()) for(const p of PARAMETERS) { const e=tr[k][p.id]; if(e&&e.complies===false) results.push({tab,key:k,param:p,value:e.value}); } }
  return results.sort((a,b)=>b.key.localeCompare(a.key)).slice(0,limit);
}

function exportCSV(tabId) {
  const tr=getAllRecords()[tabId]||{}, keys=Object.keys(tr).sort();
  if(!keys.length){showToast('No hay datos para exportar','error');return;}
  let csv='Mes/Año'; for(const p of PARAMETERS) csv+=','+p.name+','+p.name+' (Cumple?)'; csv+='\n';
  for(const k of keys) { const[y,m]=k.split('-'); csv+=`${MONTH_NAMES[parseInt(m)-1]} ${y}`; const d=tr[k]; for(const p of PARAMETERS){const e=d[p.id];csv+=`,${e?.value??''},${e?.complies===null?'Sin límite':e?.complies?'Sí':'No'}`;} csv+='\n'; }
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${tabId}_resultados.csv`;a.click();URL.revokeObjectURL(url);
}

function recalculateAllCompliance() {
  const records=getAllRecords(), limits=getLimits();
  for(const tabId of Object.keys(records)) for(const k of Object.keys(records[tabId])) for(const p of PARAMETERS) { const e=records[tabId][k][p.id]; if(e&&e.value!==null) e.complies=checkCompliance(p,e.value,limits); }
  saveAllRecords(records);
}
