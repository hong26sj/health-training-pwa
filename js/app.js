import {loadDashboard,refreshRemote,getGasUrl,setGasUrl,addMeal,deleteMeal,nutritionSummary} from './data-source.js';

const main=document.getElementById('appMain');
const title=document.getElementById('pageTitle');
const dateLabel=document.getElementById('dateLabel');
const syncBtn=document.getElementById('syncBtn');
let data=await loadDashboard();
let route='today';
const todayISO=new Date().toISOString().slice(0,10);
const todayText=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
dateLabel.textContent=todayText;

const fmtMin=m=>`${Math.floor(m/60)}시간 ${m%60}분`;
const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,v));
const icon=(name,size=20)=>{
  const paths={heart:'M12 21s-7-4.4-9.3-8.6C.8 5.4 8.2 2.4 12 6.7c3.8-4.3 11.2-1.3 9.3 5.7C19 16.6 12 21 12 21Z',bolt:'M13 2 4 14h7l-1 8 10-13h-7V2Z',moon:'M20.4 15.4A8.5 8.5 0 0 1 8.6 3.6 8.6 8.6 0 1 0 20.4 15.4Z',activity:'M3 12h4l2-6 4 12 2-6h6',food:'M7 3v7m3-7v7M5 3v5a4 4 0 0 0 8 0V3m5 0v18m0-11h3V3h-3',trend:'M4 17 10 11l4 4 6-8M16 7h4v4',plus:'M12 5v14M5 12h14',trash:'M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14',chev:'m9 18 6-6-6-6'};
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.activity}"/></svg>`;
};

function smoothPath(points){
  if(points.length<2)return '';
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=0;i<points.length-1;i++){
    const p0=points[i-1]||points[i],p1=points[i],p2=points[i+1],p3=points[i+2]||p2;
    const cp1x=p1.x+(p2.x-p0.x)/6,cp1y=p1.y+(p2.y-p0.y)/6;
    const cp2x=p2.x-(p3.x-p1.x)/6,cp2y=p2.y-(p3.y-p1.y)/6;
    d+=` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function proChart(values,{color='#5fd5df',baseline=null,unit='',labels=['월','화','수','목','금','토','오늘'],height=230}={}){
  const w=360,h=height,l=40,r=14,t=26,b=34;
  const baseValues=baseline==null?values:[...values,baseline];
  const rawMin=Math.min(...baseValues),rawMax=Math.max(...baseValues),pad=Math.max(2,(rawMax-rawMin)*.18);
  const min=rawMin-pad,max=rawMax+pad,range=max-min||1;
  const X=i=>l+i*(w-l-r)/(values.length-1),Y=v=>t+(max-v)*(h-t-b)/range;
  const pts=values.map((v,i)=>({x:X(i),y:Y(v),v}));
  const path=smoothPath(pts),area=`${path} L ${pts.at(-1).x} ${h-b} L ${pts[0].x} ${h-b} Z`;
  const id=`grad-${Math.random().toString(36).slice(2)}`;
  const ticks=[max,max-(range/3),max-(range*2/3),min];
  return `<svg class="pro-chart" viewBox="0 0 ${w} ${h}" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset=".65" stop-color="${color}" stop-opacity=".06"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v=>`<g><line x1="${l}" x2="${w-r}" y1="${Y(v)}" y2="${Y(v)}" class="chart-grid"/><text x="4" y="${Y(v)+3}" class="chart-axis">${Math.round(v*10)/10}${unit}</text></g>`).join('')}
    ${baseline!=null?`<line x1="${l}" x2="${w-r}" y1="${Y(baseline)}" y2="${Y(baseline)}" class="chart-baseline"/><text x="${w-r}" y="${Y(baseline)-7}" text-anchor="end" class="chart-baseline-label">개인 기준 ${baseline}${unit}</text>`:''}
    <path d="${area}" fill="url(#${id})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
    ${pts.map((p,i)=>i===pts.length-1?`<circle cx="${p.x}" cy="${p.y}" r="8" fill="${color}" opacity=".14"/><circle cx="${p.x}" cy="${p.y}" r="4.2" fill="${color}" stroke="#0b0c0f" stroke-width="2"/>`:'').join('')}
    ${labels.slice(0,values.length).map((v,i)=>`<text x="${X(i)}" y="${h-8}" text-anchor="middle" class="chart-x">${v}</text>`).join('')}
  </svg>`;
}

function ring(value,{color='#55d5df',label='',sub=''}={}){
  const v=clamp(value),dash=(v*2.513).toFixed(1);
  return `<div class="ring-wrap"><svg viewBox="0 0 100 100"><circle class="ring-track" cx="50" cy="50" r="40"/><circle class="ring-value" cx="50" cy="50" r="40" style="stroke:${color};stroke-dasharray:${dash} 251.3"/></svg><div class="ring-center"><strong>${Math.round(v)}<small>%</small></strong><span>${label}</span>${sub?`<em>${sub}</em>`:''}</div></div>`;
}

function rangeBar(value,{type='recovery',targetMin=null,targetMax=null,labels=['낮음','보통','양호','높음']}={}){
  return `<div class="range-viz ${type}"><div class="range-track">${targetMin!=null?`<i class="target" style="left:${targetMin}%;width:${targetMax-targetMin}%"></i>`:''}<b class="cursor" style="left:${clamp(value)}%"><span>${Math.round(value)}</span></b></div><div class="range-labels">${labels.map(x=>`<span>${x}</span>`).join('')}</div></div>`;
}

function metricCard(key,label,score,status,color,visual){
  return `<button class="metric-card premium" data-detail="${key}" style="--accent:${color}"><div class="metric-head"><span>${label}</span>${icon('chev',16)}</div><div class="metric-art">${visual}</div><div class="metric-foot"><strong>${Math.round(score)}<small>%</small></strong><span>${status}</span></div></button>`;
}

function sleepTimeline(){
  const s=data.today.sleep; const blocks=[['깊음',17,'#3458ca'],['코어',26,'#5176ff'],['REM',11,'#a063ff'],['코어',21,'#5176ff'],['깊음',9,'#3458ca'],['코어',8,'#5176ff'],['REM',6,'#a063ff'],['깨어남',2,'#ff786b']];
  return `<div class="sleep-timeline"><div class="sleep-hours"><span>23:00</span><span>02:00</span><span>05:00</span><span>08:00</span></div><div class="sleep-lanes">${blocks.map(x=>`<i style="width:${x[1]}%;background:${x[2]}" title="${x[0]}"></i>`).join('')}</div><div class="sleep-legend"><span><i style="background:#a063ff"></i>REM ${s.rem}분</span><span><i style="background:#5176ff"></i>코어</span><span><i style="background:#3458ca"></i>깊음 ${s.deep}분</span></div></div>`;
}

function macroRing(label,value,goal,unit,color){const pct=goal?clamp(value/goal*100):0;return `<div class="macro"><div class="macro-ring" style="--p:${pct};--c:${color}"><span>${Math.round(value)}</span></div><strong>${label}</strong><small>${Math.round(value)} / ${goal}${unit}</small></div>`;}

function nutritionCard(){
  const n=nutritionSummary(data,todayISO),g=data.nutrition.goal;
  return `<section class="nutrition-card"><div class="card-head"><div><span class="eyebrow">NUTRITION</span><h2>오늘의 식단</h2></div><button class="soft-btn" data-route-go="nutrition">${icon('plus',17)} 기록</button></div><div class="calorie-row"><div><strong>${n.calories.toLocaleString()}</strong><span>/ ${g.calories.toLocaleString()} kcal</span></div><div class="calorie-progress"><i style="width:${clamp(n.calories/g.calories*100)}%"></i></div></div><div class="macro-grid">${macroRing('단백질',n.protein,g.protein,'g','#5ed7d2')}${macroRing('탄수화물',n.carbs,g.carbs,'g','#8d73ff')}${macroRing('지방',n.fat,g.fat,'g','#f2b85f')}</div></section>`;
}

function todayView(){
  const t=data.today;
  return `<div class="fade-in"><section class="hero-command"><div><span class="eyebrow">DAILY READINESS</span><h2>오늘 컨디션은 <b>좋은 편</b>입니다</h2><p>회복은 충분하지만 운동 강도는 아직 목표 범위보다 낮습니다.</p></div><div class="hero-rings">${ring(t.recovery.score,{color:'#5bd7df',label:'회복'})}${ring(t.sleep.quality,{color:'#8a6dff',label:'수면'})}</div></section><div class="section-label"><h2>오늘의 상태</h2><span>${new Date(data.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span></div><section class="metric-grid">${metricCard('recovery','회복',t.recovery.score,t.recovery.status,'#5bd7df',proChart(t.recovery.trend,{color:'#5bd7df',height:112,labels:['','','','','','','']}))}${metricCard('stress','스트레스',t.stress.score,t.stress.status,'#7f73ff',rangeBar(t.stress.score,{type:'stress'}))}${metricCard('energy','신체 에너지',t.energy.score,t.energy.status,'#51d485',rangeBar(t.energy.score,{type:'energy'}))}${metricCard('training','운동 강도',t.training.score,t.training.status,'#d764aa',rangeBar(t.training.score,{type:'training',targetMin:t.training.targetMin,targetMax:t.training.targetMax}))}</section><button class="sleep-premium" data-detail="sleep"><div class="card-head"><div><span class="eyebrow">SLEEP</span><h2>${fmtMin(t.sleep.minutes)}</h2></div><div class="sleep-score"><strong>${t.sleep.quality}</strong><span>품질</span></div></div>${sleepTimeline()}</button>${nutritionCard()}<section class="body-strip"><div><span>HRV</span><strong>${t.vitals.hrv}<small> ms</small></strong></div><div><span>안정 시 심박</span><strong>${t.vitals.rhr}<small> bpm</small></strong></div><div><span>SpO₂</span><strong>${t.vitals.spo2}<small>%</small></strong></div></section></div>`;
}

const detailConfig={
  recovery:{label:'회복',color:'#5bd7df',score:d=>d.today.recovery.score,status:d=>d.today.recovery.status,trend:d=>d.today.recovery.trend,baseline:d=>d.today.recovery.hrvBaseline,unit:'',facts:d=>[['HRV',`${d.today.recovery.hrv} ms`,`기준 ${d.today.recovery.hrvBaseline} ms`],['안정 시 심박',`${d.today.recovery.rhr} bpm`,`기준 ${d.today.recovery.rhrBaseline} bpm`]]},
  stress:{label:'스트레스',color:'#8075ff',score:d=>d.today.stress.score,status:d=>d.today.stress.status,trend:d=>d.today.stress.trend,baseline:d=>d.today.stress.avgBaseline,unit:'%',facts:d=>[['평균 스트레스',`${d.today.stress.avg}%`,`14일 ${d.today.stress.avgBaseline}%`],['안정 시 심박',`${d.today.stress.rhr} bpm`,'심박 반응']]},
  energy:{label:'신체 에너지',color:'#50d287',score:d=>d.today.energy.score,status:d=>d.today.energy.status,trend:d=>d.today.energy.trend,baseline:d=>null,unit:'%',facts:d=>[['야간 충전',`${d.today.energy.overnightCharge}%`,'수면 기반'],['주간 소모',`${d.today.energy.dayDrain}%`,'활동 기반']]},
  training:{label:'운동 강도',color:'#d764aa',score:d=>d.today.training.score,status:d=>d.today.training.status,trend:d=>[12,21,18,34,27,31,d.today.training.score],baseline:d=>null,unit:'%',facts:d=>[['권장 범위',`${d.today.training.targetMin}–${d.today.training.targetMax}%`,'회복 상태 반영'],['활동 에너지',`${d.today.training.calories} kcal`,'오늘 누적']]}
};

function detailView(key){
  if(key==='sleep')return sleepView();
  const c=detailConfig[key],score=c.score(data);
  return `<div class="detail-premium fade-in" style="--accent:${c.color}"><div class="detail-nav"><button data-back>‹</button><div><strong>${c.label}</strong><span>${todayText}</span></div><button>···</button></div><section class="score-hero"><div class="score-copy"><span class="eyebrow">TODAY</span><strong>${score}<small>%</small></strong><h2>${c.status(data)}</h2></div>${ring(score,{color:c.color,label:c.label})}</section><section class="facts-grid">${c.facts(data).map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('')}</section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">7 DAY TREND</span><h2>최근 추세</h2></div><span class="status-dot">LIVE</span></div>${proChart(c.trend(data),{color:c.color,baseline:c.baseline(data),unit:c.unit})}</section><section class="insight-premium"><div class="insight-icon">✦</div><div><strong>오늘의 해석</strong><p>${key==='recovery'?'HRV가 개인 기준선보다 높고 안정 시 심박은 낮습니다. 고강도 운동도 가능하지만 최근 부하를 함께 확인하는 것이 좋습니다.':key==='stress'?'오늘 스트레스 반응은 변동폭이 큰 편입니다. 오후 회복 구간과 수면 상태를 함께 보세요.':key==='energy'?'야간 충전 후 일중 활동으로 에너지가 감소했습니다. 현재 수준에서는 일반적인 일상 활동이 무난합니다.':'현재 운동 강도는 권장 범위 아래입니다. 회복 상태를 고려하면 중간 강도 이상의 훈련 여지가 있습니다.'}</p></div></section></div>`;
}

function sleepView(){const s=data.today.sleep;return `<div class="detail-premium fade-in" style="--accent:#9274ff"><div class="detail-nav"><button data-back>‹</button><div><strong>수면</strong><span>${todayText}</span></div><button>···</button></div><section class="score-hero sleep-hero"><div class="score-copy"><span class="eyebrow">LAST NIGHT</span><strong>${fmtMin(s.minutes)}</strong><h2>수면 품질 ${s.quality}%</h2></div>${ring(s.quality,{color:'#9274ff',label:'품질'})}</section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">SLEEP STAGES</span><h2>수면 단계</h2></div><span>${s.efficiency}% 효율</span></div>${sleepTimeline()}</section><section class="facts-grid four"><div><span>깊은 수면</span><strong>${s.deep}분</strong><small>회복</small></div><div><span>REM</span><strong>${s.rem}분</strong><small>인지 회복</small></div><div><span>효율성</span><strong>${s.efficiency}%</strong><small>수면 유지</small></div><div><span>규칙성</span><strong>${s.consistency}%</strong><small>생활 리듬</small></div></section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">14 DAY QUALITY</span><h2>수면 품질 추세</h2></div></div>${proChart([64,71,67,75,69,72,s.quality],{color:'#9274ff',baseline:s.avg14Quality,unit:'%'})}</section></div>`;}

function healthView(){const v=data.today.vitals;return `<div class="fade-in"><div class="page-intro"><span class="eyebrow">HEALTH</span><h2>건강 지표</h2><p>최근 측정값과 개인 기준 변화를 함께 봅니다.</p></div><section class="health-hero"><div><span>VO₂ Max</span><strong>${v.vo2max}</strong><small>ml/kg/min</small></div>${ring(62,{color:'#63d69e',label:'심폐 체력',sub:'보통'})}</section><section class="metric-list premium-list">${[['HRV',`${v.hrv} ms`,'회복성','#5bd7df'],['안정 시 심박',`${v.rhr} bpm`,'낮은 편','#63d69e'],['호흡수',`${v.resp} BrPM`,'정상','#6e9cff'],['혈중 산소',`${v.spo2}%`,'정상','#9b7cff'],['체지방률',`${v.bodyFat}%`,'높은 편','#f0a85d'],['제지방량',`${v.leanMass} kg`,'최근값','#e17bc2']].map(x=>`<div class="premium-row" style="--row:${x[3]}"><i></i><div><span>${x[0]}</span><small>${x[2]}</small></div><strong>${x[1]}</strong>${icon('chev',16)}</div>`).join('')}</section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">HRV TREND</span><h2>HRV 추세</h2></div></div>${proChart([29,32,31,34,36,39,v.hrv],{color:'#5bd7df',baseline:30,unit:' ms'})}</section></div>`;}

function nutritionView(){
  const n=nutritionSummary(data,todayISO),g=data.nutrition.goal;
  return `<div class="fade-in"><div class="page-intro nutrition-intro"><span class="eyebrow">NUTRITION</span><h2>식단 기록</h2><p>칼로리뿐 아니라 단백질·탄수화물·지방을 하루 단위로 관리합니다.</p></div><section class="nutrition-dashboard"><div class="nutrition-energy"><div><span>섭취</span><strong>${n.calories.toLocaleString()}</strong><small>kcal</small></div><div class="remaining"><span>남음</span><strong>${Math.max(0,g.calories-n.calories).toLocaleString()}</strong></div></div><div class="calorie-progress big"><i style="width:${clamp(n.calories/g.calories*100)}%"></i><b style="left:100%"></b></div><div class="macro-grid large">${macroRing('단백질',n.protein,g.protein,'g','#5ed7d2')}${macroRing('탄수화물',n.carbs,g.carbs,'g','#8d73ff')}${macroRing('지방',n.fat,g.fat,'g','#f2b85f')}</div></section><section class="meal-form-card"><div class="analysis-title"><div><span class="eyebrow">QUICK LOG</span><h2>식사 추가</h2></div></div><form id="mealForm"><div class="form-row"><select name="type"><option>아침</option><option>점심</option><option>저녁</option><option>간식</option></select><input name="name" placeholder="음식 또는 식사명" required></div><div class="nutrient-inputs"><label><span>kcal</span><input name="calories" type="number" inputmode="numeric" min="0" required></label><label><span>단백질 g</span><input name="protein" type="number" inputmode="decimal" min="0"></label><label><span>탄수 g</span><input name="carbs" type="number" inputmode="decimal" min="0"></label><label><span>지방 g</span><input name="fat" type="number" inputmode="decimal" min="0"></label></div><button class="primary-action" type="submit">${icon('plus',18)} 식사 기록</button></form></section><section class="meal-list"><div class="analysis-title"><div><span class="eyebrow">TODAY</span><h2>오늘 기록</h2></div><span>${n.meals.length}회</span></div>${n.meals.sort((a,b)=>a.time.localeCompare(b.time)).map(x=>`<div class="meal-row"><div class="meal-time"><strong>${x.time}</strong><span>${x.type}</span></div><div class="meal-main"><strong>${x.name}</strong><span>P ${x.protein} · C ${x.carbs} · F ${x.fat}</span></div><div class="meal-kcal"><strong>${x.calories}</strong><span>kcal</span></div><button class="delete-meal" data-delete-meal="${x.id}" aria-label="삭제">${icon('trash',17)}</button></div>`).join('')||'<div class="empty">오늘 식사 기록이 없습니다.</div>'}</section></div>`;
}

function journalView(){const n=nutritionSummary(data,todayISO);return `<div class="fade-in"><div class="page-intro"><span class="eyebrow">LOG</span><h2>기록</h2><p>운동·회복·식단을 한곳에서 확인합니다.</p></div><button class="hub-card nutrition-hub" data-route-go="nutrition"><div>${icon('food',24)}<span>식단</span></div><strong>${n.calories.toLocaleString()}<small> kcal</small></strong><p>단백질 ${n.protein}g · 탄수 ${n.carbs}g · 지방 ${n.fat}g</p>${icon('chev',20)}</button><section class="hub-grid"><div class="mini-hub"><span>회복</span><strong>${data.today.recovery.score}%</strong><small>${data.today.recovery.status}</small></div><div class="mini-hub"><span>수면</span><strong>${data.today.sleep.quality}%</strong><small>${fmtMin(data.today.sleep.minutes)}</small></div></section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">AI SUMMARY</span><h2>통합 분석</h2></div><span class="status-dot">ON DEMAND</span></div><p class="muted-copy">식단·운동·수면·회복 데이터를 묶어 필요할 때만 AI 분석을 실행하는 영역입니다.</p></section></div>`;}

function workoutView(){const recent=data.strength.recent||[];return `<div class="fade-in"><div class="page-intro"><span class="eyebrow">WORKOUT</span><h2>근력운동</h2><p>최근 수행량과 세션 기록을 관리합니다.</p></div><section class="workout-hero"><div><span>최근 7일</span><strong>${recent.length}<small> records</small></strong></div><button id="startWorkout" class="primary-action">${icon('plus',18)} 운동 기록</button></section><section class="metric-list premium-list">${recent.map(x=>`<div class="premium-row"><i style="background:#f2b85f"></i><div><span>${x.name}</span><small>${x.date}</small></div><strong class="compact-value">${x.summary}</strong>${icon('chev',16)}</div>`).join('')||'<div class="empty">최근 운동 기록이 없습니다.</div>'}</section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">VOLUME</span><h2>주간 운동량</h2></div></div><div class="professional-bars">${[52,68,34,76,61,88,43].map((v,i)=>`<div><span style="height:${v}%"></span><small>${['월','화','수','목','금','토','일'][i]}</small></div>`).join('')}</div></section><section class="integration-card"><h3>기존 근력 기록 연동</h3><input id="gasInput" class="input-dark" type="url" placeholder="Apps Script /exec URL" value="${getGasUrl()}"><button id="saveGas" class="soft-btn full">저장</button></section></div>`;}

function trainingView(){const t=data.training;return `<div class="fade-in"><div class="page-intro"><span class="eyebrow">TRAINING</span><h2>트레이닝</h2><p>단기 피로와 장기 체력의 균형을 확인합니다.</p></div><section class="load-cards"><div><span>ATL</span><strong>${t.atl}</strong><small>단기 부하</small></div><div><span>CTL</span><strong>${t.ctl}</strong><small>장기 체력</small></div><div class="accent-load"><span>TSB</span><strong>${t.tsb}</strong><small>훈련 균형</small></div></section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">TRAINING BALANCE</span><h2>TSB 추세</h2></div></div>${proChart([-6,-2,1,4,2,-1,t.tsb],{color:'#f0a85d',baseline:0})}</section><section class="analysis-card"><div class="analysis-title"><div><span class="eyebrow">LOAD FOCUS</span><h2>훈련 부하 중점</h2></div></div><div class="focus-pro"><i style="width:${t.focusLow}%;background:#53ce84"></i><i style="width:${t.focusHigh}%;background:#6f7cff"></i><i style="width:${t.focusAnaerobic}%;background:#d764aa"></i></div><div class="focus-labels"><span><i style="background:#53ce84"></i>저강도 ${t.focusLow}%</span><span><i style="background:#6f7cff"></i>고강도 ${t.focusHigh}%</span><span><i style="background:#d764aa"></i>무산소 ${t.focusAnaerobic}%</span></div></section><section class="recovery-card"><div><span>운동 후 심박 회복</span><strong>${t.hrRecovery}<small> bpm</small></strong></div><div class="hr-drop"><i></i><b>1분 회복</b></div></section></div>`;}

function render(){
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.route===route||(route==='nutrition'&&x.dataset.route==='journal')));
  const names={today:'오늘',health:'건강',journal:'기록',nutrition:'식단',workout:'운동',training:'트레이닝'};
  title.textContent=route.startsWith('detail:')?'':names[route]||'오늘';
  document.querySelector('.app-header').classList.toggle('hidden-on-detail',route.startsWith('detail:'));
  main.innerHTML=route==='today'?todayView():route==='health'?healthView():route==='journal'?journalView():route==='nutrition'?nutritionView():route==='workout'?workoutView():route==='training'?trainingView():route.startsWith('detail:')?detailView(route.split(':')[1]):todayView();
  bindDynamic();
  window.scrollTo({top:0,behavior:'instant'});
}

function bindDynamic(){
  main.querySelectorAll('[data-detail]').forEach(el=>el.addEventListener('click',()=>{route=`detail:${el.dataset.detail}`;render();}));
  main.querySelectorAll('[data-route-go]').forEach(el=>el.addEventListener('click',()=>{route=el.dataset.routeGo;render();}));
  main.querySelector('[data-back]')?.addEventListener('click',()=>{route='today';render();});
  main.querySelector('#saveGas')?.addEventListener('click',()=>{setGasUrl(main.querySelector('#gasInput').value);main.querySelector('#saveGas').textContent='저장됨';});
  main.querySelector('#startWorkout')?.addEventListener('click',()=>alert('기존 workout-logger의 근력 입력 폼을 다음 단계에서 그대로 이식합니다.'));
  main.querySelector('#mealForm')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);data=addMeal(data,Object.fromEntries(f.entries()));render();});
  main.querySelectorAll('[data-delete-meal]').forEach(btn=>btn.addEventListener('click',()=>{data=deleteMeal(data,btn.dataset.deleteMeal);render();}));
}

document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',()=>{route=el.dataset.route;render();}));
syncBtn.addEventListener('click',async()=>{syncBtn.disabled=true;syncBtn.classList.add('spin');data=await refreshRemote();syncBtn.disabled=false;syncBtn.classList.remove('spin');render();});
render();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
