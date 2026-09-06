import {loadDashboard,refreshRemote,getGasUrl,setGasUrl} from './data-source.js';

const main=document.getElementById('appMain');
const title=document.getElementById('pageTitle');
const dateLabel=document.getElementById('dateLabel');
const syncBtn=document.getElementById('syncBtn');
let data=await loadDashboard();
let route='today';

const fmtMin=m=>`${Math.floor(m/60)}시간${m%60?`${m%60}분`:''}`;
const pct=n=>`${Math.round(n)}%`;
const todayText=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
dateLabel.textContent=todayText;

function spark(values,color='#55b8e6'){
  const w=180,h=58,p=5,min=Math.min(...values),max=Math.max(...values),r=(max-min)||1;
  const pts=values.map((v,i)=>`${p+i*(w-2*p)/(values.length-1)},${h-p-(v-min)*(h-2*p)/r}`).join(' ');
  return `<svg class="mini-line" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function fullChart(values,color='#55b8e6'){
  const w=320,h=170,p=18,min=Math.min(...values),max=Math.max(...values),r=(max-min)||1;
  const pts=values.map((v,i)=>({x:p+i*(w-2*p)/(values.length-1),y:h-p-(v-min)*(h-2*p)/r,v}));
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#363941"/><polyline points="${pts.map(x=>`${x.x},${x.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(x=>`<circle cx="${x.x}" cy="${x.y}" r="4" fill="${color}"/>`).join('')}</svg>`;
}

function metricCard(key,label,value,status,visual){return `<button class="metric-card" data-detail="${key}"><div class="metric-title">${label}</div><div class="metric-visual">${visual}</div><div class="metric-value-row"><strong class="metric-value">${value}</strong><span class="metric-status">${status}</span></div></button>`;}

function todayView(){
  const t=data.today;
  return `<section class="hero"><div class="suggestion"><div class="kicker">✦ 오늘의 제안</div><p>회복 ${t.recovery.score}% · 수면 ${t.sleep.quality}%입니다. 현재 상태를 기준으로 무리한 고강도보다는 목표 범위 안에서 훈련하는 편이 적절합니다.</p></div></section>
  <section class="metric-grid">
    ${metricCard('recovery','회복',pct(t.recovery.score),t.recovery.status,spark(t.recovery.trend,'#55d5e6'))}
    ${metricCard('stress','스트레스',pct(t.stress.score),t.stress.status,`<div class="gauge"><span style="width:${t.stress.score}%"></span></div>`)}
    ${metricCard('energy','신체 에너지',pct(t.energy.score),t.energy.status,`<div class="gauge energy"><span style="width:${t.energy.score}%"></span></div>`)}
    ${metricCard('training','운동 강도',pct(t.training.score),t.training.status,`<div class="gauge"><span style="width:${t.training.score}%"></span></div>`)}
  </section>
  <button class="section-card sleep-card" data-detail="sleep" style="width:100%;border:0;text-align:left"><h2>수면</h2><div class="progress"><span style="width:${Math.min(100,t.sleep.minutes/t.sleep.targetMinutes*100)}%"></span></div><div class="big-row"><strong>${fmtMin(t.sleep.minutes)}</strong><span class="subtle">수면 품질 ${t.sleep.quality}%</span></div></button>
  <section class="section-card"><h2>신체 지표</h2><div class="vitals"><div class="vital"><span>HRV</span><strong>${t.vitals.hrv} ms</strong></div><div class="vital"><span>안정 시 심박</span><strong>${t.vitals.rhr} bpm</strong></div><div class="vital"><span>SpO₂</span><strong>${t.vitals.spo2}%</strong></div></div></section>`;
}

const detailConfig={
 recovery:{label:'회복',className:'recovery',score:d=>d.today.recovery.score,status:d=>d.today.recovery.status,comparisons:d=>[['오늘의 평균 HRV',`${d.today.recovery.hrv} ms`,`14일 평균 ${d.today.recovery.hrvBaseline} ms`],['RHR',`${d.today.recovery.rhr} bpm`,`14일 평균 ${d.today.recovery.rhrBaseline} bpm`]],trend:d=>d.today.recovery.trend,insight:d=>`오늘 HRV가 개인 기준선보다 높고 RHR은 낮은 편입니다. 회복 상태는 양호한 방향으로 해석할 수 있습니다.`},
 stress:{label:'스트레스',className:'stress',score:d=>d.today.stress.score,status:d=>d.today.stress.status,comparisons:d=>[['평균 스트레스',`${d.today.stress.avg}%`,`14일 평균 ${d.today.stress.avgBaseline}%`],['RHR',`${d.today.stress.rhr} bpm`,`기준 ${d.today.recovery.rhrBaseline} bpm`]],trend:d=>d.today.stress.trend,insight:d=>'스트레스 점수는 HRV·심박·수면·최근 부하를 결합한 MVP 추정치입니다. Pro 분석 후 가중치를 보정할 예정입니다.'},
 energy:{label:'신체 에너지',className:'energy',score:d=>d.today.energy.score,status:d=>d.today.energy.status,comparisons:d=>[['야간 충전',`${d.today.energy.overnightCharge}%`,`수면 기반 회복량`],['주간 소모',`${d.today.energy.dayDrain}%`,`활동·운동 기반`]],trend:d=>d.today.energy.trend,insight:d=>`오늘 에너지 범위는 ${d.today.energy.rangeMin}%~${d.today.energy.rangeMax}%입니다. 현재 값은 ${d.today.energy.score}%입니다.`},
 training:{label:'운동 강도',className:'training',score:d=>d.today.training.score,status:d=>d.today.training.status,comparisons:d=>[['목표 범위',`${d.today.training.targetMin}%–${d.today.training.targetMax}%`,`회복 ${d.today.training.recovery}% 기준`],['소모됨',`${d.today.training.calories} kcal`,'오늘 활동 에너지']],trend:d=>[8,12,18,22,24],insight:d=>'현재 회복 상태와 최근 훈련 부하를 기반으로 목표 운동강도 범위를 산정하는 구조입니다.'},
 sleep:{label:'수면',className:'sleep',score:d=>d.today.sleep.quality,status:d=>'수면 품질',comparisons:d=>[['수면 시간',fmtMin(d.today.sleep.minutes),`목표 ${fmtMin(d.today.sleep.targetMinutes)}`],['수면 효율',`${d.today.sleep.efficiency}%`,`규칙성 ${d.today.sleep.consistency}%`]],trend:d=>[64,71,67,75,69,72,d.today.sleep.quality],insight:d=>`총 수면 ${fmtMin(d.today.sleep.minutes)}, 깊은 수면 ${d.today.sleep.deep}분, REM ${d.today.sleep.rem}분입니다.`}
};

function detailView(key){
  const c=detailConfig[key]; if(!c) return todayView();
  const score=c.score(data); const comps=c.comparisons(data);
  return `<div class="detail-page"><button class="back-btn" data-back>‹</button><section class="detail-hero ${c.className}"><div class="subtle">${c.label}</div><div class="detail-score">${score}<span style="font-size:.45em">%</span></div><div class="detail-status">${c.status(data)}</div><div class="detail-bar"><span style="width:${score}%"></span></div></section><section class="comparison-grid">${comps.map(x=>`<div class="compare"><span>${x[0]}</span><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('')}</section><div class="insight">${c.insight(data)}</div><section class="chart-card"><h2>최근 추세</h2>${fullChart(c.trend(data),key==='stress'?'#6e71ff':'#55b8e6')}</section></div>`;
}

function healthView(){const v=data.today.vitals;return `<section class="section-card"><h2>건강 지표</h2><div class="list">${[['VO₂ Max',v.vo2max,''],['HRV',v.hrv,'ms'],['안정 시 심박',v.rhr,'bpm'],['호흡수',v.resp,'BrPM'],['혈중 산소',v.spo2,'%'],['체중',v.weight,'kg'],['BMI',v.bmi,'kg/m²'],['체지방률',v.bodyFat,'%'],['제지방량',v.leanMass,'kg']].map(x=>`<div class="list-row"><div>${x[0]}<div class="meta">최근 측정값</div></div><strong>${x[1]}${x[2]}</strong></div>`).join('')}</div></section>`;}

function journalView(){return `<section class="section-card"><h2>기록</h2><p class="subtle">MVP에서는 최근 건강/운동 요약과 이후 AI 분석 기록을 이 영역에 통합합니다.</p><div class="list"><div class="list-row"><div>오늘 상태<div class="meta">회복 ${data.today.recovery.score}% · 수면 ${data.today.sleep.quality}%</div></div><span class="pill">자동</span></div><div class="list-row"><div>저널 태그 영향 분석<div class="meta">Pro 검증 이후 구현 예정</div></div><span class="pill">2차</span></div></div></section>`;}

function workoutView(){return `<section class="section-card"><h2>근력운동</h2><button class="workout-cta" id="startWorkout">+ 근력운동 기록</button><div class="list" style="margin-top:12px">${(data.strength.recent||[]).map(x=>`<div class="list-row"><div><strong>${x.name}</strong><div class="meta">${x.date}</div></div><div style="text-align:right">${x.summary}</div></div>`).join('')||'<div class="empty">최근 기록 없음</div>'}</div></section><section class="section-card"><h2>연동 설정</h2><p class="subtle">기존 workout-logger의 Apps Script URL을 설정하면 인증 토큰이 동일 기기에 있는 경우 최근 근력 기록을 읽을 수 있습니다.</p><input id="gasInput" type="url" placeholder="Apps Script /exec URL" value="${getGasUrl()}" style="width:100%;padding:14px;border-radius:14px;border:1px solid #34363e;background:#0d0f13;color:white"><button id="saveGas" class="workout-cta" style="margin-top:10px">연동 URL 저장</button></section>`;}

function trainingView(){const t=data.training;return `<section class="section-card"><h2>훈련 부하</h2><div class="metric-value-row"><strong class="metric-value">${t.tsb}</strong><span class="metric-status">TSB</span></div><div class="comparison-grid"><div class="compare"><span>ATL</span><strong>${t.atl}</strong><span>급성 부하</span></div><div class="compare"><span>CTL</span><strong>${t.ctl}</strong><span>만성 부하</span></div></div></section><section class="section-card"><h2>운동 중 심박수 구간</h2><div class="progress"><span style="width:${t.zone0}%"></span></div><div class="subtle">영역 0 · ${t.zone0}%</div></section><section class="section-card"><h2>훈련 부하 중점</h2><div class="progress"><span style="width:${t.focusLow}%;background:#75c86d"></span></div><strong>${t.focusLow}% / ${t.focusHigh}% / ${t.focusAnaerobic}%</strong><div class="meta">저강도 / 고강도 / 무산소</div></section><section class="section-card"><h2>운동 후 심박수 회복</h2><strong style="font-size:38px">${t.hrRecovery} BPM</strong></section>`;}

function render(){
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.route===route));
  title.textContent=route==='today'?'오늘':({health:'건강',journal:'기록',workout:'운동',training:'트레이닝'})[route]||'상세';
  main.innerHTML=route==='today'?todayView():route==='health'?healthView():route==='journal'?journalView():route==='workout'?workoutView():route==='training'?trainingView():route.startsWith('detail:')?detailView(route.split(':')[1]):todayView();
  bindDynamic();
}

function bindDynamic(){
  main.querySelectorAll('[data-detail]').forEach(el=>el.addEventListener('click',()=>{route=`detail:${el.dataset.detail}`;render();}));
  main.querySelector('[data-back]')?.addEventListener('click',()=>{route='today';render();});
  main.querySelector('#saveGas')?.addEventListener('click',()=>{setGasUrl(main.querySelector('#gasInput').value);alert('연동 URL을 저장했습니다.');});
  main.querySelector('#startWorkout')?.addEventListener('click',()=>alert('다음 단계에서 기존 근력운동 입력 폼을 이 화면에 이식합니다.'));
}

document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',()=>{route=el.dataset.route;render();}));
syncBtn.addEventListener('click',async()=>{syncBtn.disabled=true;syncBtn.textContent='…';data=await refreshRemote();render();syncBtn.textContent='↻';syncBtn.disabled=false;});
render();

if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
