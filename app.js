import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// Esta configuración corresponde al proyecto Firebase System-Cochera.
// Si cambias de proyecto, reemplaza estos valores por los de tu aplicación web.
const firebaseConfig = {
  apiKey: "AIzaSyAeuRSZE5erE8qI5wB85yLPoeO54Vpxxnw",
  authDomain: "system-cochera.firebaseapp.com",
  projectId: "system-cochera",
  storageBucket: "system-cochera.firebasestorage.app",
  messagingSenderId: "641999371426",
  appId: "1:641999371426:web:b9d02f45f2a7cbdc8fabfb"
};

const configured = !Object.values(firebaseConfig).some(v => !v || v.startsWith('TU_'));
let auth, db, user, clients = [], payments = [], active = null, month = new Date(), selected = new Set(), register = false;
const $ = id => document.getElementById(id);
const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => key(new Date());
const date = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d,12); };
const money = n => 'S/ ' + Number(n || 0).toFixed(2);
const fmt = s => date(s).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){ $('toast').textContent=msg; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2600); }
function page(p){
  ['dashboard','clients','detail','history'].forEach(x=>$(x).classList.toggle('hidden',x!==p));
  $('heading').textContent=({dashboard:'Resumen general',clients:'Clientes',detail:'Estado de cuenta',history:'Historial de pagos'})[p];
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  if(p==='history') renderHistory();
}
const covered = c => [...new Set(payments.filter(p=>p.clientId===c.id).flatMap(p=>p.days||[]))];
const isPaid = (c,d) => covered(c).includes(d);
function pendingDays(c){
  const out=[];
  // El último día facturable es la fecha de finalización (inclusive), o hoy si no existe.
  const lastDay = c.endDate && c.endDate < today() ? c.endDate : today();
  if (c.endDate && c.endDate < c.startDate) return out;
  for(let d=date(c.startDate); key(d)<=lastDay; d.setDate(d.getDate()+1)){
    const k=key(d); if(!isPaid(c,k)) out.push(k);
  }
  return out;
}
const debtDays = c => pendingDays(c).length;
const rentalFinished = c => Boolean(c.endDate && c.endDate < today());
const rentalOngoing = c => !c.endDate || c.endDate >= today();
const debtAmount = c => debtDays(c)*Number(c.dailyRate||0);
function status(c){ return debtDays(c)>0?'Debe':'Al día'; }
async function refresh(){
  const [cs,ps]=await Promise.all([
    getDocs(query(collection(db,'clients'),where('uid','==',user.uid))),
    getDocs(query(collection(db,'payments'),where('uid','==',user.uid)))
  ]);
  clients=cs.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>a.name.localeCompare(b.name));
  payments=ps.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.paymentDate||'').localeCompare(a.paymentDate||''));
  renderDashboard();
}
function clientCard(c){
  const due=debtAmount(c), days=debtDays(c);
  const stateLabel = rentalFinished(c) ? (days ? 'Debe · finalizado' : 'Finalizado') : (days ? 'Debe' : 'Al día');
  return `<article class="client-card">
    <div class="client-card-head"><div class="person"><div class="avatar">${esc((c.name||'C').trim().charAt(0).toUpperCase())}</div><div><h4>${esc(c.name)}</h4><p>${esc(c.vehicle)}</p></div></div><span class="status-pill ${days?'due':''}">${stateLabel}</span></div>
    <div class="client-balance"><div><small>SALDO PENDIENTE</small><strong class="${days?'':'clear'}">${money(due)}</strong><small>${days} día(s) vencido(s) · ${money(c.dailyRate)} / día</small></div><button data-open="${c.id}">Ver cuenta →</button></div>
  </article>`;
}
function debtRow(c){
  const days=debtDays(c), due=debtAmount(c);
  return `<article class="debt-row"><div class="person"><div class="avatar">${esc((c.name||'C').trim().charAt(0).toUpperCase())}</div><div><b>${esc(c.name)}</b><small>${esc(c.vehicle)}</small></div></div><div class="debt-meta"><small>TARIFA DIARIA</small><b>${money(c.dailyRate)}</b></div><div class="debt-meta days-meta"><small>DÍAS PENDIENTES</small><b>${days}</b></div><div class="debt-meta"><small>DEBE</small><b class="${days?'owed':''}">${money(due)}</b></div><button data-open="${c.id}">Ver detalle</button></article>`;
}
function renderDashboard(){
  const monthKey=today().slice(0,7), monthPayments=payments.filter(p=>(p.paymentDate||'').startsWith(monthKey));
  const activeClients=clients.filter(c=>c.active!==false && rentalOngoing(c));
  const totalDebt=clients.reduce((s,c)=>s+debtAmount(c),0), totalDueDays=clients.reduce((s,c)=>s+debtDays(c),0);
  $('sClients').textContent=activeClients.length;
  $('sIncome').textContent=money(monthPayments.reduce((s,p)=>s+Number(p.amount||0),0));
  $('sDebt').textContent=money(totalDebt);
  $('sDebtDays').textContent=`${totalDueDays} día(s) vencido(s) pendientes`;
  $('sPaid').textContent=activeClients.reduce((s,c)=>s+covered(c).filter(d=>d.startsWith(monthKey)).length,0);
  $('todayLabel').textContent=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  // También mostramos alquileres finalizados que todavía tengan saldo pendiente.
  const sorted=[...clients].filter(c=>debtDays(c)>0 || rentalOngoing(c)).sort((a,b)=>debtAmount(b)-debtAmount(a));
  $('debtList').innerHTML=sorted.length?sorted.map(debtRow).join(''):'<div class="empty-state">Todavía no hay clientes. Registra tu primer alquiler para comenzar.</div>';
  renderClients();
}
function renderClients(){
  const term=($('search').value||'').toLowerCase();
  const arr=clients.filter(c=>(`${c.name} ${c.vehicle}`).toLowerCase().includes(term));
  $('clientList').innerHTML=arr.length?arr.map(clientCard).join(''):'<div class="empty-state">No se encontraron clientes.</div>';
}
function openClient(id){
  active=clients.find(c=>c.id===id); if(!active)return;
  month=date(today()); selected.clear(); renderDetail(); page('detail');
}
function renderDetail(){
  const c=active, paid=covered(c), days=debtDays(c), due=debtAmount(c);
  const endLabel = c.endDate ? ` · Hasta ${fmt(c.endDate)}` : ' · Sin fecha de finalización';
  const rentalLabel = rentalFinished(c) ? 'Alquiler finalizado' : 'Alquiler vigente';
  $('detailContent').innerHTML=`
    <div class="detail-head"><div><h2>${esc(c.name)}</h2><p>${esc(c.vehicle)} · Desde ${fmt(c.startDate)}${endLabel} · ${rentalLabel}</p></div><div class="detail-rate">${money(c.dailyRate)}<small>Tarifa por día</small></div></div>
    <div class="mini-stats"><div><small>DEUDA ACTUAL</small><b class="red-value">${money(due)}</b></div><div><small>DÍAS VENCIDOS PENDIENTES</small><b>${days}</b></div><div><small>DÍAS PAGADOS</small><b style="color:#159765">${paid.length}</b></div></div>
    <div class="calendar"><div class="cal-head"><h3>Calendario de pagos</h3><div><button id="prev" aria-label="Mes anterior">‹</button> <b id="monthLabel"></b> <button id="next" aria-label="Mes siguiente">›</button></div></div>
      <div id="calGrid" class="cal-grid"></div>
      <div class="legend"><span><i style="background:#159765"></i>Pagado</span><span><i style="background:#d6535d"></i>Pendiente vencido</span><span><i style="background:#d8dde6"></i>Futuro</span><span><i style="background:#5275e8"></i>Seleccionado</span></div>
      <div class="cal-footer"><span id="selectionInfo">Selecciona días pendientes o futuros para registrar un pago o adelanto.</span><button id="paySelected" class="btn btn-primary" disabled>Registrar pago</button></div>
    </div>`;
  drawCalendar();
  $('prev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1,12);selected.clear();drawCalendar();};
  $('next').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1,12);selected.clear();drawCalendar();};
  $('paySelected').onclick=openPay;
}
function drawCalendar(){
  const c=active,y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),offset=(first.getDay()+6)%7;
  $('monthLabel').textContent=month.toLocaleDateString('es-PE',{month:'long',year:'numeric'});
  let html=['LU','MA','MI','JU','VI','SA','DO'].map(x=>`<div class="weekday">${x}</div>`).join('');
  for(let i=0;i<offset;i++)html+='<div></div>';
  for(let n=1;n<=last.getDate();n++){
    const d=key(new Date(y,m,n,12)),future=d>today(),before=d<c.startDate,afterEnd=Boolean(c.endDate && d>c.endDate),paid=isPaid(c,d);
    const outside=before||afterEnd;
    const cls=outside||future?'future':paid?'paid':'unpaid';
    const label=before?'No iniciado':afterEnd?'Fuera del alquiler':paid?'✓ Pagado':future?'Futuro':'Pendiente';
    html+=`<button class="day ${cls} ${selected.has(d)?'selected':''}" data-day="${d}" ${paid||outside?'disabled':''}><span>${n}</span><span class="status">${label}</span></button>`;
  }
  $('calGrid').innerHTML=html;
  $('calGrid').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{
    const d=b.dataset.day; selected.has(d)?selected.delete(d):selected.add(d); drawCalendar();
  });
  $('selectionInfo').textContent=selected.size?`${selected.size} día(s) seleccionados · Total ${money(selected.size*Number(c.dailyRate))}`:'Selecciona días pendientes o futuros para registrar un pago o adelanto.';
  $('paySelected').disabled=!selected.size;
}
function openPay(){
  $('payClient').textContent=`${active.name} · ${money(active.dailyRate)} por día`;
  $('payDays').textContent=`${selected.size} día(s) seleccionados`;
  $('payAmount').textContent=money(selected.size*Number(active.dailyRate));
  $('received').value=today(); $('payError').textContent=''; $('payModal').showModal();
}
async function savePayment(){
  const days=[...selected].sort(),c=active; if(!days.length)return;
  if(days.some(d=>isPaid(c,d)))throw Error('Una de las fechas ya está pagada. Actualiza el calendario.');
  // Para esta versión de un único administrador, validamos antes de guardar.
  // En un despliegue con varios cobradores simultáneos, esta operación debe migrarse a una Cloud Function transaccional.
  const existing=await getDocs(query(collection(db,'payments'),where('uid','==',user.uid),where('clientId','==',c.id)));
  const used=new Set(existing.docs.flatMap(x=>x.data().days||[]));
  if(days.some(d=>used.has(d)))throw Error('Una fecha seleccionada ya está pagada. Actualiza el calendario.');
  const amount=days.length*Number(c.dailyRate);
  await addDoc(collection(db,'payments'),{
    uid:user.uid,clientId:c.id,clientName:c.name,days,amount,dailyRate:Number(c.dailyRate),
    paymentDate:$('received').value,method:$('method').value,note:$('payNote').value.trim(),createdAt:new Date()
  });
  $('payModal').close();selected.clear();await refresh();active=clients.find(x=>x.id===c.id);renderDetail();toast('Pago registrado correctamente.');
}
async function saveClient(){
  const x={uid:user.uid,name:$('name').value.trim(),vehicle:$('vehicle').value.trim(),dailyRate:Number($('rate').value),startDate:$('start').value,endDate:$('endDate').value||null,notes:$('notes').value.trim(),active:true,createdAt:new Date()};
  if(!x.name||!x.vehicle||!x.startDate||x.dailyRate<=0)throw Error('Completa los campos correctamente.');
  if(x.endDate && x.endDate<x.startDate)throw Error('La fecha de finalización no puede ser anterior al inicio del alquiler.');
  await addDoc(collection(db,'clients'),x);$('clientModal').close();$('clientForm').reset();await refresh();toast('Cliente registrado correctamente.');
}
function renderHistory(){
  $('historyList').innerHTML=payments.length?payments.map(p=>`<article class="history-row"><div><b>${esc(p.clientName)}</b><small>${fmt(p.paymentDate)} · ${p.days?.length||0} día(s) · ${esc(p.method||'')}</small><small>Fechas cubiertas: ${(p.days||[]).map(fmt).join(', ')}</small>${p.note?`<small>${esc(p.note)}</small>`:''}</div><b class="amount">${money(p.amount)}</b></article>`).join(''):'<div class="empty-state">Todavía no hay pagos registrados.</div>';
}
function bind(){
  $('authForm').onsubmit=async e=>{
    e.preventDefault();if(!configured){$('authError').textContent='Revisa la configuración de Firebase en app.js.';return;}
    try{if(register)await createUserWithEmailAndPassword(auth,$('email').value,$('password').value);else await signInWithEmailAndPassword(auth,$('email').value,$('password').value);}
    catch(x){$('authError').textContent=({'auth/invalid-credential':'Correo o contraseña incorrectos.','auth/email-already-in-use':'El correo ya está registrado.','auth/weak-password':'La contraseña debe tener al menos 6 caracteres.','auth/invalid-email':'El correo no tiene un formato válido.'})[x.code]||x.message;}
  };
  $('toggleAuth').onclick=()=>{register=!register;$('authButton').textContent=register?'Crear cuenta':'Ingresar';$('toggleAuth').textContent=register?'Ya tengo cuenta':'¿No tienes cuenta? Crear cuenta';};
  $('logout').onclick=()=>signOut(auth);
  $('newClient').onclick=()=>{$('start').value=today();$('endDate').value='';$('clientError').textContent='';$('clientModal').showModal();};
  $('clientForm').onsubmit=async e=>{e.preventDefault();try{await saveClient();}catch(x){$('clientError').textContent=x.message;}};
  $('payForm').onsubmit=async e=>{e.preventDefault();try{await savePayment();}catch(x){$('payError').textContent=x.message;}};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>page(b.dataset.page));
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>page(b.dataset.goto));
  $('back').onclick=()=>page('clients');$('search').oninput=renderClients;
  document.body.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openClient(b.dataset.open);});
}
bind();
if(configured){
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async u=>{
    user=u;$('login').classList.toggle('hidden',!!u);$('app').classList.toggle('hidden',!u);
    if(u){try{await refresh();page('dashboard');}catch(e){console.error(e);toast('Error al cargar. Revisa las reglas de Firestore.');}}
  });
}else $('authError').textContent='Configura Firebase en app.js para comenzar.';
