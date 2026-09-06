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
  const w=320,h=190,p=18,min=Math.min(...values),max=Math.max(...values),r=(max-min)||1;
  const pts=values.map((v,i)=>({x:p+i*(w-2*p)/(values.length-1),y:h-p-(v-min)*(h-2*p)/r,v}));
  const grid=[.25,.5,.75].map(t=>`<line x1="${p}" y1="${p+(h-2*p)*t}" x2="${w-p}" y2="${p+(h-2*p)*t}" stroke="#25272c" stroke-width="1"/>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}">${grid}<polyline points="${pts.map(x=>`${x.x},${x.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(x=>`<circle cx="${x.x}" cy="${x.y}" r="4.2" fill="${color}"/>`).join('')}</svg>`;
}

function metricCard(key,label,value,status,visual,glow,statusColor){return `<button class="metric-card" data-detail="${key}" style="--card-glow:${glow};--status:${statusColor}"><div class="metric-title">${label}</div><div class="metric-visual">${visual}</div><div class="metric-value-row"><strong class="metric-value">${value}</strong><span class="metric-status">${status}</span></div></button>`;}

function todayView(){
  const t=data.today;
  return `<div class="fade-in">
    <section class="hero"><div class="suggestion"><div class="kicker">✦ 오늘의 제안</div><p>회복 ${t.recovery.score}% · 수면 ${t.sleep.quality}%입니다. 현재 상태에서는 무리한 고강도보다 목표 범위 안에서 훈련하는 편이 적절합니다.</p></div></section>
    <div class="overview-title"><h2>오늘의 상태</h2><span>마지막 동기화 ${new Date(data.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span></div>
    <section class="metric-grid">
      ${metricCard('recovery','회복',pct(t.recovery.score),t.recovery.status,spark(t.recovery.trend,'#29cbd8'),'#1fd0da','#45d7df')}
      ${metricCard('stress','스트레스',pct(t.stress.score),t.stress.status,`<div class="gauge stress"><span style="width:${t.stress.score}%"></span></div>`,'#6c5bf0','#777bff')}
      ${metricCard('energy','신체 에너지',pct(t.energy.score),t.energy.status,`<div class="gauge energy"><span style="width:${t.energy.score}%"></span></div>`,'#23d16f','#ff9500')}
      ${metricCard('training','운동 강도',pct(t.training.score),t.training.status,`<div class="gauge training"><span style="width:${t.training.score}%"></span></div>`,'#b13d7e','#7385ff')}
    </section>
    <button class="section-card sleep-card" data-detail="sleep" style="width:100%;border:1px solid #24262a;text-align:left;color:inherit"><div class="sleep-head"><h2>수면</h2><span class="score">품질 ${t.sleep.quality}% ›</span></div><div class="progress"><span style="width:${Math.min(100,t.sleep.minutes/t.sleep.targetMinutes*100)}%"></span></div><div class="big-row"><strong>${fmtMin(t.sleep.minutes)}</strong><span class="subtle">목표 ${fmtMin(t.sleep.targetMinutes)}</span></div></button>
    <section class="section-card"><div class="sleep-head"><h2>신체 지표</h2><span class="score">자세히 보기</span></div><div class="vitals"><div class="vital"><span>HRV</span><strong>${t.vitals.hrv} ms</strong><small>양호</small></div><div class="vital"><span>안정 시 심박</span><strong>${t.vitals.rhr} bpm</strong><small>낮음</small></div><div class="vital"><span>SpO₂</span><strong>${t.vitals.spo2}%</strong><small>정상</small></div></div></section>
  </div>`;
}

const detailConfig={
 recovery:{label:'회복',className:'recovery',score:d=>d.today.recovery.score,status:d=>d.today.recovery.status,range:d=>'오늘 상태',rangeValue:d=>`${d.today.recovery.score}%`,comparisons:d=>[['오늘의 평균 HRV',`${d.today.recovery.hrv} MS`,`14일 평균 ${d.today.recovery.hrvBaseline}MS`],['RHR',`${d.today.recovery.rhr} BPM`,`14일 평균 ${d.today.recovery.rhrBaseline}BPM`]],trend:d=>d.today.recovery.trend,insight:d=>`오늘 HRV는 개인 기준선보다 높고 RHR은 낮은 편입니다. 회복 상태는 양호한 방향으로 해석할 수 있습니다.`},
 stress:{label:'스트레스',className:'stress',score:d=>d.today.stress.score,status:d=>d.today.stress.status,range:d=>'당일 스트레스',rangeValue:d=>`${d.today.stress.avg}%`,comparisons:d=>[['평균 스트레스',`${d.today.stress.avg}%`,`14일 평균 ${d.today.stress.avgBaseline}%`],['RHR',`${d.today.stress.rhr} BPM`,`기준 ${d.today.recovery.rhrBaseline}BPM`]],trend:d=>d.today.stress.trend,insight:d=>'현재 스트레스는 HRV·심박·수면·최근 훈련 부하를 결합한 MVP 추정치입니다.'},
 energy:{label:'신체 에너지',className:'energy',score:d=>d.today.energy.score,status:d=>d.today.energy.status,range:d=>'오늘 범위',rangeValue:d=>`${d.today.energy.rangeMin}%~${d.today.energy.rangeMax}%`,comparisons:d=>[['야간 충전',`${d.today.energy.overnightCharge}%`,'수면 기반 회복량'],['주간 소모',`${d.today.energy.dayDrain}%`,'활동·운동 기반']],trend:d=>d.today.energy.trend,insight:d=>`현재 에너지 수준은 ${d.today.energy.score}%입니다. 일상적인 업무와 생활을 처리하기에는 무리가 적은 수준입니다.`},
 training:{label:'운동 강도',className:'training',score:d=>d.today.training.score,status:d=>d.today.training.status,range:d=>'목표 범위',rangeValue:d=>`${d.today.training.targetMin}%–${d.today.training.targetMax}%`,comparisons:d=>[['목표 범위',`${d.today.training.targetMin}%–${d.today.training.targetMax}%`,`회복 ${d.today.training.recovery}% 기준`],['소모됨',`${d.today.training.calories} KCAL`,'오늘 활동 에너지']],trend:d=>[8,12,18,22,24],insight:d=>'현재 회복 상태와 최근 훈련 부하를 기준으로 오늘의 목표 운동 강도 범위를 산정합니다.'},
 sleep:{label:'수면',className:'sleep',score:d=>d.today.sleep.quality,status:d=>'잘 잤어요',range:d=>'총 수면',rangeValue:d=>fmtMin(d.today.sleep.minutes),comparisons:d=>[['수면 시간',fmtMin(d.today.sleep.minutes),`목표 ${fmtMin(d.today.sleep.targetMinutes)}`],['수면 품질',`${d.today.sleep.quality}%`,`14일 평균 ${d.today.sleep.avg14Quality}%`]],trend:d=>[64,71,67,75,69,72,d.today.sleep.quality],insight:d=>`지난밤 총 수면은 ${fmtMin(d.today.sleep.minutes)}입니다. 깊은 수면 ${d.today.sleep.deep}분, REM ${d.today.sleep.rem}분으로 기록되었습니다.`}
};

function qualityRows(){const s=data.today.sleep;const rows=[['총 수면','◷',100,'9시간22분','#55a7ff'],['회복 수면','◉',Math.min(100,Math.round((s.deep+s.rem)/220*100)),'주의 필요','#8a48ee'],['연속성','⌁',76,'보통','#27c9c5'],['효율성','◔',s.efficiency,'훌륭함','#2386ff'],['규칙성','◎',s.consistency,'주의 필요','#a64ae6']];return `<div class="quality-list">${rows.map(r=>`<div class="quality-row"><div class="quality-icon" style="color:${r[4]}">${r[1]}</div><div class="quality-main"><span>${r[0]}</span><div class="mini-progress"><i style="width:${r[2]}%;--q:${r[4]}"></i></div></div><div class="quality-value">${r[3]} ›</div></div>`).join('')}</div>`;}

function detailView(key){
  const c=detailConfig[key]; if(!c) return todayView(); const score=c.score(data);const comps=c.comparisons(data);
  return `<div class="detail-page fade-in"><div class="detail-topbar"><button class="circle-action" data-back>‹</button><div class="center"><strong>${c.label}</strong><span>${todayText}</span></div><button class="circle-action" aria-label="공유">⇧</button></div><section class="detail-hero ${c.className}"><div class="detail-score">${score}<span>%</span></div><div class="detail-status">${c.status(data)}</div><div class="detail-range"><span>${c.range(data)}</span><strong>${c.rangeValue(data)}</strong></div><div class="detail-bar"><span style="width:${score}%"></span></div></section><div class="detail-content"><section class="comparison-grid">${comps.map(x=>`<div class="compare"><span>${x[0]}</span><strong>${x[1]}</strong><em>${x[2]}</em></div>`).join('')}</section><div class="update-line">마지막 업데이트 ${new Date(data.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div><div class="insight">${c.insight(data)}</div><section class="detail-section"><div class="detail-section-title"><h2>${key==='sleep'?'수면 품질 차원':'최근 추세'}</h2><span class="subtle">ⓘ</span></div>${key==='sleep'?qualityRows():`<div class="chart-card">${fullChart(c.trend(data),key==='stress'?'#626cff':key==='energy'?'#35ce76':'#4cb8ee')}</div>`}</section></div></div>`;
}

function healthView(){const v=data.today.vitals;const cards=[['VO₂ Max',v.vo2max,'정상'],['HRV',`${v.hrv} ms`,'정상'],['안정 시 심박',`${v.rhr} bpm`,'낮음'],['호흡수',`${v.resp} BrPM`,'정상'],['혈중 산소',`${v.spo2}%`,'정상'],['체중',`${v.weight} kg`,'증가'],['BMI',v.bmi,'과체중'],['체지방률',`${v.bodyFat}%`,'약간 높음']];return `<div class="fade-in"><div class="screen-title"><div><h2>건강</h2><p>심폐·회복·체성분 지표</p></div></div><section class="feature-hero" style="--fh:#5c5fff"><div class="hero-label">생체 나이</div><div class="hero-number">39.0</div><div class="hero-status">실제 나이 대비 +0.4세</div></section><section class="health-grid">${cards.map(x=>`<div class="health-card"><span class="label">${x[0]}</span><strong>${x[1]}</strong><div class="state">${x[2]}</div></div>`).join('')}</section><section class="section-card"><h2>체성분</h2><div class="vitals"><div class="vital"><span>체중</span><strong>${v.weight}kg</strong></div><div class="vital"><span>BMI</span><strong>${v.bmi}</strong></div><div class="vital"><span>제지방량</span><strong>${v.leanMass}kg</strong></div></div></section></div>`;}

function journalView(){return `<div class="fade-in"><div class="screen-title"><div><h2>기록</h2><p>상태 변화와 분석 이력</p></div></div><section class="feature-hero" style="--fh:#8b47ee"><div class="hero-label">오늘 요약</div><div class="hero-number">${data.today.recovery.score}%</div><div class="hero-status">회복 ${data.today.recovery.status}</div></section><section class="journal-card"><h3>오늘 상태</h3><div class="list"><div class="list-row"><div>회복<div class="meta">HRV ${data.today.recovery.hrv}ms · RHR ${data.today.recovery.rhr}bpm</div></div><span class="pill">${data.today.recovery.score}%</span></div><div class="list-row"><div>수면<div class="meta">${fmtMin(data.today.sleep.minutes)} · 품질 ${data.today.sleep.quality}%</div></div><span class="pill">자동</span></div><div class="list-row"><div>저널 태그 영향 분석<div class="meta">Pro 검증 후 상관분석 기능 추가</div></div><span class="pill">2차</span></div></div></section><section class="journal-card"><h3>AI 분석 기록</h3><div class="list-row"><div>통합 분석<div class="meta">사용자가 요청할 때만 실행</div></div><span class="pill">대기</span></div></section></div>`;}

function workoutView(){const recent=(data.strength.recent||[]);return `<div class="fade-in"><div class="screen-title"><div><h2>운동</h2><p>근력운동 기록과 최근 수행</p></div></div><section class="feature-hero" style="--fh:#ff9b32"><div class="hero-label">최근 30일</div><div class="hero-number">16.4<span style="font-size:.4em">h</span></div><div class="hero-status">근력 기록을 중심으로 관리합니다</div></section><section class="workout-block"><h3>근력운동</h3><button class="workout-cta" id="startWorkout">+ 근력운동 기록</button><div class="list" style="margin-top:11px">${recent.map(x=>`<div class="list-row"><div><strong>${x.name}</strong><div class="meta">${x.date}</div></div><div style="text-align:right;font-size:13px">${x.summary}</div></div>`).join('')||'<div class="empty">최근 기록 없음</div>'}</div></section><section class="workout-block"><h3>연동 설정</h3><p class="subtle" style="font-size:13px;line-height:1.45">기존 workout-logger의 Apps Script URL을 연결하면 최근 근력 기록을 읽어옵니다.</p><input class="input-dark" id="gasInput" type="url" placeholder="Apps Script /exec URL" value="${getGasUrl()}"><button id="saveGas" class="workout-cta" style="margin-top:10px">연동 URL 저장</button></section></div>`;}

function zoneRow(label,value,color){return `<div class="zone-row"><small>${label}</small><div class="zone-track"><i style="width:${value}%;background:${color}"></i></div><strong>${value}%</strong></div>`;}
function trainingView(){const t=data.training;return `<div class="fade-in"><div class="screen-title"><div><h2>트레이닝</h2><p>부하·심박·회복 분석</p></div></div><section class="feature-hero" style="--fh:#3b8aff"><div class="hero-label">훈련 부하 TSB</div><div class="hero-number">${t.tsb}</div><div class="hero-status">현재 훈련 상태</div></section><section class="training-block"><h3>훈련 부하</h3><div class="load-hero"><div class="load-stat"><span>ATL · 급성 부하</span><strong>${t.atl}</strong></div><div class="load-stat"><span>CTL · 만성 부하</span><strong>${t.ctl}</strong></div></div><div class="chart-card">${fullChart([18,21,24,28,32,38,t.atl],'#4da4ff')}</div></section><section class="training-block"><h3>운동 중 심박수 구간</h3>${zoneRow('영역 1',32,'#5799ff')}${zoneRow('영역 2',28,'#58c781')}${zoneRow('영역 3',22,'#f0c744')}${zoneRow('영역 4',12,'#ff8e42')}${zoneRow('영역 5',6,'#ff4d58')}</section><section class="training-block"><h3>훈련 부하 중점</h3>${zoneRow('저강도',t.focusLow,'#65c66f')}${zoneRow('고강도',t.focusHigh,'#5e86ff')}${zoneRow('무산소',t.focusAnaerobic,'#b54be5')}</section><section class="training-block"><h3>운동 후 심박수 회복</h3><div class="load-stat"><span>1분 회복</span><strong>${t.hrRecovery} BPM</strong></div></section></div>`;}

function render(){
  const topRoutes=['today','health','journal','workout','training'];
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.route===route));
  const isDetail=route.startsWith('detail:');
  document.querySelector('.app-header').style.display=isDetail?'none':'flex';
  if(!isDetail) title.textContent=route==='today'?'오늘':({health:'건강',journal:'기록',workout:'운동',training:'트레이닝'})[route]||'오늘';
  main.innerHTML=route==='today'?todayView():route==='health'?healthView():route==='journal'?journalView():route==='workout'?workoutView():route==='training'?trainingView():isDetail?detailView(route.split(':')[1]):todayView();
  bindDynamic();
  window.scrollTo({top:0,behavior:'instant'});
}

function bindDynamic(){
  main.querySelectorAll('[data-detail]').forEach(el=>el.addEventListener('click',()=>{route=`detail:${el.dataset.detail}`;render();}));
  main.querySelector('[data-back]')?.addEventListener('click',()=>{route='today';render();});
  main.querySelector('#saveGas')?.addEventListener('click',()=>{setGasUrl(main.querySelector('#gasInput').value);alert('연동 URL을 저장했습니다.');});
  main.querySelector('#startWorkout')?.addEventListener('click',()=>alert('다음 단계에서 기존 workout-logger의 근력운동 입력 폼을 이 화면에 이식합니다.'));
}

document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',()=>{route=el.dataset.route;render();}));
syncBtn.addEventListener('click',async()=>{syncBtn.disabled=true;syncBtn.textContent='…';data=await refreshRemote();render();syncBtn.textContent='↻';syncBtn.disabled=false;});
render();

if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
