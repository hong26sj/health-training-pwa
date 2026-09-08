import {nutritionSummary,mealTotals,upsertMeal,deleteMeal,setNutritionGoals} from './data-source.js';

const isoToday=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct=(v,g)=>g>0?Math.max(0,Math.min(100,v/g*100)):0;
const mealColor=t=>({아침:'#ffb13b',점심:'#6fb3ff',저녁:'#9c72ff',간식:'#48d08a'}[t]||'#ffb13b');

function macroRing(label,value,goal,unit,color){
  const p=pct(value,goal),r=33,c=2*Math.PI*r,d=c*p/100;
  return `<div class="macro-ring-card" style="--ring:${color}"><div class="macro-ring-wrap"><svg viewBox="0 0 82 82"><circle class="macro-track" cx="41" cy="41" r="33"/><circle class="macro-value" cx="41" cy="41" r="33" stroke-dasharray="${d} ${c-d}"/></svg><div class="macro-center"><strong>${Math.round(value)}</strong><span>${unit}</span></div></div><b>${label}</b><small>${Math.round(value)} / ${Math.round(goal)} ${unit}</small></div>`;
}

function energyBalance(summary,goals){
  const target=goals.kcal||1,delta=Math.round(summary.kcal-target),ratio=Math.max(-100,Math.min(100,delta/target*100));
  return `<section class="nutrition-energy-hero"><div class="energy-top"><div><span>오늘 에너지 균형</span><strong class="${delta>0?'over':'under'}">${delta>0?'+':''}${delta}<small> kcal</small></strong><b>${delta<=0?'칼로리 적자':'칼로리 초과'}</b></div><div class="energy-remaining"><span>남은 목표</span><strong>${Math.max(0,target-summary.kcal)}</strong><small>kcal</small></div></div><div class="energy-balance-scale"><div class="scale-fill"></div><b style="left:${50+ratio/2}%"></b><i class="zero"></i></div><div class="energy-scale-labels"><span>-목표</span><span>0</span><span>+목표</span></div></section>`;
}

function cumulativeChart(meals,goals,key='kcal'){
  const goal=goals[key]||1,unit=key==='kcal'?'':'g',w=350,h=212,l=32,r=12,t=14,b=28;
  const sorted=[...meals].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  let total=0;const pts=[{hr:6,v:0}];
  sorted.forEach(m=>{const [hh,mm]=(m.time||'12:00').split(':').map(Number);total+=mealTotals(m)[key]||0;pts.push({hr:(hh||12)+(mm||0)/60,v:total});});
  pts.push({hr:22,v:total});
  const ymax=Math.max(goal,total*1.12,1),X=v=>l+(v-6)/16*(w-l-r),Y=v=>t+(ymax-v)/ymax*(h-t-b);
  const path=pts.map((p,i)=>`${i?'L':'M'} ${X(p.hr)} ${Y(p.v)}`).join(' '),area=`${path} L ${X(22)} ${h-b} L ${X(6)} ${h-b} Z`;
  const target=[6,10,14,18,22].map(hr=>({hr,v:goal*((hr-6)/16)})),targetPath=target.map((p,i)=>`${i?'L':'M'} ${X(p.hr)} ${Y(p.v)}`).join(' ');
  return `<svg class="nutrition-chart" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="nutArea2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffad3d" stop-opacity=".28"/><stop offset="1" stop-color="#ffad3d" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(f=>`<line class="grid" x1="${l}" y1="${Y(goal*f)}" x2="${w-r}" y2="${Y(goal*f)}"/>`).join('')}<path d="${area}" fill="url(#nutArea2)"/><path d="${targetPath}" class="goal" fill="none"/><path d="${path}" fill="none" stroke="#ffad3d" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>${pts.slice(1,-1).map(p=>`<circle cx="${X(p.hr)}" cy="${Y(p.v)}" r="4.5" fill="#111318" stroke="#ffad3d" stroke-width="3"/>`).join('')}<text class="goal-label" x="${w-r}" y="${Y(goal)-6}" text-anchor="end">목표 ${Math.round(goal)}${unit}</text>${[6,10,14,18,22].map(hr=>`<text class="axis" x="${X(hr)}" y="${h-7}" text-anchor="middle">${hr}</text>`).join('')}</svg>`;
}

function photoGrid(meal){
  const photos=meal.photos||[];
  if(!photos.length)return `<div class="meal-photo-grid empty-photos"><div>사진 없음</div><button data-edit-meal="${meal.id}">+ 사진 추가</button></div>`;
  return `<div class="meal-photo-grid ${photos.length===1?'single':''}">${photos.slice(0,4).map((p,i)=>`<div><img src="${p}" alt="${esc(meal.title)} 사진 ${i+1}">${i===3&&photos.length>4?`<span>+${photos.length-4}</span>`:''}</div>`).join('')}</div>`;
}

function mealCard(meal){
  const t=mealTotals(meal),macro=t.protein*4+t.carbs*4+t.fat*9||1;
  return `<div class="meal-timeline-row" style="--meal:${mealColor(meal.type)}"><div class="timeline-time"><b>${esc(meal.time)}</b><span>${esc(meal.type)}</span></div><div class="timeline-node"></div><article class="meal-card-pro"><button class="meal-main-btn" data-open-meal="${meal.id}"><div class="meal-card-title"><div><span>${esc(meal.type)}</span><h4>${esc(meal.title)}</h4></div><strong>${Math.round(t.kcal)}<small> kcal</small></strong></div>${photoGrid(meal)}<div class="meal-macros"><span>P <b>${Math.round(t.protein)}g</b></span><span>C <b>${Math.round(t.carbs)}g</b></span><span>F <b>${Math.round(t.fat)}g</b></span></div><div class="macro-stack"><i style="width:${t.protein*4/macro*100}%;background:#58b3ff"></i><i style="width:${t.carbs*4/macro*100}%;background:#9b72ff"></i><i style="width:${t.fat*9/macro*100}%;background:#ffd05b"></i></div></button><div class="meal-card-actions"><button data-edit-meal="${meal.id}">수정</button><button data-delete-meal="${meal.id}">삭제</button></div></article></div>`;
}

export function renderNutrition(data,chartKey='kcal'){
  const s=nutritionSummary(data,isoToday()),g=s.goals;
  const proteinLeft=Math.max(0,g.protein-s.protein);
  return `<div class="nutrition-shell fade-in"><div class="nutrition-toolbar"><div><span>오늘</span><strong>${new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric'}).format(new Date())}</strong></div><button id="addMealBtn">＋</button></div>${energyBalance(s,g)}<section class="macro-ring-grid">${macroRing('칼로리',s.kcal,g.kcal,'kcal','#ff9f35')}${macroRing('단백질',s.protein,g.protein,'g','#58b3ff')}${macroRing('탄수화물',s.carbs,g.carbs,'g','#9b72ff')}${macroRing('지방',s.fat,g.fat,'g','#ffd05b')}</section><section class="nutrition-advice"><span>✦</span><p>${proteinLeft>0?`단백질이 ${Math.round(proteinLeft)}g 부족합니다. 다음 식사에서 단백질을 우선 보충하세요.`:'현재 단백질 목표를 달성했습니다.'}</p><b>⌄</b></section><section class="nutrition-section"><div class="nutrition-section-head"><h3>목표 대비 누적</h3><button id="goalBtn">목표 설정</button></div><div class="nutrition-chart-card"><div class="nutrition-toggle">${[['kcal','칼로리'],['protein','단백질'],['carbs','탄수화물'],['fat','지방']].map(([k,l])=>`<button data-chart-key="${k}" class="${chartKey===k?'active':''}">${l}</button>`).join('')}</div>${cumulativeChart(s.meals,g,chartKey)}</div></section><section class="nutrition-section"><div class="nutrition-section-head"><h3>식단 로그</h3><span>${s.meals.length}회</span></div><div class="quick-meal-row">${['아침','점심','저녁','간식'].map(t=>`<button data-quick-type="${t}"><i>${t==='아침'?'☀':t==='점심'?'◉':t==='저녁'?'☾':'⌁'}</i><span>+${t}</span></button>`).join('')}</div><div class="meal-timeline">${s.meals.map(mealCard).join('')||'<div class="empty">아직 기록된 식사가 없습니다.</div>'}</div></section></div>`;
}

function blankMeal(type='아침'){return {id:'',date:isoToday(),time:new Date().toTimeString().slice(0,5),type,title:'',photos:[],note:'',tags:[],items:[{id:`item-${Date.now()}`,name:'',amount:'',kcal:0,protein:0,carbs:0,fat:0}]};}
function itemEditor(item,index){return `<div class="food-item-edit" data-item-index="${index}"><div class="food-item-head"><strong>음식 ${index+1}</strong><button data-remove-item="${index}">삭제</button></div><div class="food-item-top"><input class="input-pro" data-field="name" value="${esc(item.name)}" placeholder="음식명"><input class="input-pro" data-field="amount" value="${esc(item.amount)}" placeholder="수량/중량"></div><div class="food-macro-grid"><label><span>kcal</span><input class="input-pro" type="number" data-field="kcal" value="${item.kcal||0}"></label><label><span>P</span><input class="input-pro" type="number" data-field="protein" value="${item.protein||0}"></label><label><span>C</span><input class="input-pro" type="number" data-field="carbs" value="${item.carbs||0}"></label><label><span>F</span><input class="input-pro" type="number" data-field="fat" value="${item.fat||0}"></label></div></div>`;}
function modalShell(inner){return `<div class="nutrition-modal-backdrop"><div class="nutrition-modal"><div class="modal-grabber"></div>${inner}</div></div>`;}
export function mealEditorModal(meal=blankMeal()){
  const m=JSON.parse(JSON.stringify(meal));
  return modalShell(`<div class="modal-head"><div><span>${m.id?'EDIT MEAL':'ADD MEAL'}</span><h3>${m.id?'식사 수정':'식사 추가'}</h3></div><button data-close-modal>×</button></div><div class="form-row"><label>식사 종류</label><div class="meal-type-picker">${['아침','점심','저녁','간식'].map(t=>`<button type="button" data-meal-type="${t}" class="${m.type===t?'active':''}">${t}</button>`).join('')}</div></div><div class="form-grid"><div class="form-row"><label>날짜</label><input id="mealDate" class="input-pro" type="date" value="${m.date}"></div><div class="form-row"><label>시간</label><input id="mealTime" class="input-pro" type="time" value="${m.time}"></div></div><div class="form-row"><label>식사 제목</label><input id="mealTitle" class="input-pro" value="${esc(m.title)}" placeholder="예: 운동 후 아침"></div><div class="form-row"><label>음식 사진</label><label class="photo-upload-zone"><span>카메라 또는 앨범에서 추가</span><small>여러 장 선택 가능</small><input id="mealPhotos" type="file" accept="image/*" multiple></label><div class="photo-preview-grid" id="photoPreview">${(m.photos||[]).map((p,i)=>`<div class="photo-preview"><img src="${p}"><button data-remove-photo="${i}">×</button></div>`).join('')}</div></div><div class="form-row"><label>음식 목록</label><div id="foodItems">${m.items.map(itemEditor).join('')}</div><button class="add-food-btn" id="addFoodItem">＋ 음식 추가</button></div><div class="form-row"><label>메모</label><textarea id="mealNote" class="input-pro" rows="3" placeholder="운동 전/후, 외식 등">${esc(m.note)}</textarea></div><div class="form-row"><label>태그</label><input id="mealTags" class="input-pro" value="${esc((m.tags||[]).join(', '))}" placeholder="운동 후, 외식"></div><div class="modal-summary" id="modalSummary"></div><button class="save-meal-btn" id="saveMealBtn">저장</button>${m.id?'<button class="danger-btn" id="deleteMealBtn">이 식사 삭제</button>':''}<input type="hidden" id="mealId" value="${esc(m.id)}"></div>`);
}
export function mealDetailModal(meal){
  const t=mealTotals(meal),photos=meal.photos||[];
  return modalShell(`<div class="modal-head"><div><span style="color:${mealColor(meal.type)}">${esc(meal.type)} · ${esc(meal.time)}</span><h3>${esc(meal.title)}</h3></div><button data-close-modal>×</button></div>${photos.length?`<div class="detail-photo-gallery">${photos.slice(0,4).map(p=>`<img src="${p}">`).join('')}</div>`:'<div class="detail-photo-hero">음식 사진 없음</div>'}<div class="modal-summary"><div><span>칼로리</span><strong>${Math.round(t.kcal)}</strong><small>kcal</small></div><div><span>단백질</span><strong>${Math.round(t.protein)}</strong><small>g</small></div><div><span>탄수화물</span><strong>${Math.round(t.carbs)}</strong><small>g</small></div><div><span>지방</span><strong>${Math.round(t.fat)}</strong><small>g</small></div></div><div class="detail-food-list">${meal.items.map(i=>`<div class="detail-food-row"><div><div class="name">${esc(i.name)}</div><div class="amount">${esc(i.amount)}</div></div><div class="nums"><strong>${Math.round(i.kcal)} kcal</strong><span>P ${i.protein} · C ${i.carbs} · F ${i.fat}</span></div></div>`).join('')}</div>${meal.note?`<div class="meal-note">${esc(meal.note)}</div>`:''}<div class="tag-row">${(meal.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><button class="save-meal-btn" data-edit-meal="${meal.id}">수정</button><button class="danger-btn" data-delete-meal="${meal.id}">삭제</button>`);
}
export function goalModal(goals){return modalShell(`<div class="modal-head"><div><span>DAILY TARGET</span><h3>일일 목표</h3></div><button data-close-modal>×</button></div><div class="goal-grid"><label><span>칼로리</span><input id="goalKcal" class="input-pro" type="number" value="${goals.kcal}"><small>kcal</small></label><label><span>단백질</span><input id="goalProtein" class="input-pro" type="number" value="${goals.protein}"><small>g</small></label><label><span>탄수화물</span><input id="goalCarbs" class="input-pro" type="number" value="${goals.carbs}"><small>g</small></label><label><span>지방</span><input id="goalFat" class="input-pro" type="number" value="${goals.fat}"><small>g</small></label></div><button class="save-meal-btn" id="saveGoalBtn">목표 저장</button>`);}

export function bindNutrition(root,data,{onDataChange,onChartKey}){
  const openModal=html=>{document.body.insertAdjacentHTML('beforeend',html);bindModal();};
  root.querySelector('#addMealBtn')?.addEventListener('click',()=>openModal(mealEditorModal()));
  root.querySelectorAll('[data-quick-type]').forEach(b=>b.addEventListener('click',()=>openModal(mealEditorModal(blankMeal(b.dataset.quickType)))));
  root.querySelector('#goalBtn')?.addEventListener('click',()=>openModal(goalModal(nutritionSummary(data,isoToday()).goals)));
  root.querySelectorAll('[data-chart-key]').forEach(b=>b.addEventListener('click',()=>onChartKey?.(b.dataset.chartKey)));
  root.querySelectorAll('[data-open-meal]').forEach(b=>b.addEventListener('click',()=>{const meal=data.nutrition.meals.find(x=>x.id===b.dataset.openMeal);if(meal)openModal(mealDetailModal(meal));}));
  root.querySelectorAll('[data-edit-meal]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const meal=data.nutrition.meals.find(x=>x.id===b.dataset.editMeal);if(meal)openModal(mealEditorModal(meal));}));
  root.querySelectorAll('[data-delete-meal]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(confirm('이 식사를 삭제할까요?'))onDataChange?.(deleteMeal(data,b.dataset.deleteMeal));}));

  function bindModal(){
    const modal=document.querySelector('.nutrition-modal-backdrop:last-of-type');if(!modal)return;
    const close=()=>modal.remove();
    modal.querySelector('[data-close-modal]')?.addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.querySelectorAll('[data-edit-meal]').forEach(b=>b.addEventListener('click',()=>{const meal=data.nutrition.meals.find(x=>x.id===b.dataset.editMeal);close();if(meal)openModal(mealEditorModal(meal));}));
    modal.querySelectorAll('[data-delete-meal]').forEach(b=>b.addEventListener('click',()=>{if(confirm('이 식사를 삭제할까요?')){onDataChange?.(deleteMeal(data,b.dataset.deleteMeal));close();}}));
    modal.querySelectorAll('[data-meal-type]').forEach(b=>b.addEventListener('click',()=>{modal.querySelectorAll('[data-meal-type]').forEach(x=>x.classList.remove('active'));b.classList.add('active');}));
    modal.querySelector('#addFoodItem')?.addEventListener('click',()=>{const wrap=modal.querySelector('#foodItems'),idx=wrap.querySelectorAll('.food-item-edit').length;wrap.insertAdjacentHTML('beforeend',itemEditor({id:`item-${Date.now()}`,name:'',amount:'',kcal:0,protein:0,carbs:0,fat:0},idx));bindItemButtons();updateSummary();});
    const bindItemButtons=()=>modal.querySelectorAll('[data-remove-item]').forEach(b=>{b.onclick=()=>{b.closest('.food-item-edit')?.remove();updateSummary();};});
    bindItemButtons();
    modal.querySelectorAll('input,textarea').forEach(i=>i.addEventListener('input',updateSummary));
    modal.querySelector('#mealPhotos')?.addEventListener('change',async e=>{const grid=modal.querySelector('#photoPreview');for(const f of [...e.target.files]){const url=await fileToDataURL(f);grid.insertAdjacentHTML('beforeend',`<div class="photo-preview"><img src="${url}"><button>×</button></div>`);}grid.querySelectorAll('button').forEach(b=>b.onclick=()=>b.parentElement.remove());});
    modal.querySelectorAll('[data-remove-photo]').forEach(b=>b.addEventListener('click',()=>b.parentElement.remove()));
    modal.querySelector('#saveMealBtn')?.addEventListener('click',()=>{const items=[...modal.querySelectorAll('.food-item-edit')].map((row,i)=>({id:`item-${Date.now()}-${i}`,name:row.querySelector('[data-field="name"]').value.trim(),amount:row.querySelector('[data-field="amount"]').value.trim(),kcal:+row.querySelector('[data-field="kcal"]').value||0,protein:+row.querySelector('[data-field="protein"]').value||0,carbs:+row.querySelector('[data-field="carbs"]').value||0,fat:+row.querySelector('[data-field="fat"]').value||0})).filter(x=>x.name||x.kcal||x.protein||x.carbs||x.fat);const photos=[...modal.querySelectorAll('#photoPreview img')].map(x=>x.src);const meal={id:modal.querySelector('#mealId').value,date:modal.querySelector('#mealDate').value,time:modal.querySelector('#mealTime').value,type:modal.querySelector('[data-meal-type].active')?.dataset.mealType||'간식',title:modal.querySelector('#mealTitle').value.trim()||'식사',photos,note:modal.querySelector('#mealNote').value.trim(),tags:modal.querySelector('#mealTags').value.split(',').map(x=>x.trim()).filter(Boolean),items};onDataChange?.(upsertMeal(data,meal));close();});
    modal.querySelector('#deleteMealBtn')?.addEventListener('click',()=>{const id=modal.querySelector('#mealId').value;if(id&&confirm('이 식사를 삭제할까요?')){onDataChange?.(deleteMeal(data,id));close();}});
    modal.querySelector('#saveGoalBtn')?.addEventListener('click',()=>{const goals={kcal:+modal.querySelector('#goalKcal').value||0,protein:+modal.querySelector('#goalProtein').value||0,carbs:+modal.querySelector('#goalCarbs').value||0,fat:+modal.querySelector('#goalFat').value||0};onDataChange?.(setNutritionGoals(data,goals));close();});
    updateSummary();
    function updateSummary(){const out=modal.querySelector('#modalSummary');if(!out)return;const vals=[...modal.querySelectorAll('.food-item-edit')].reduce((a,row)=>({kcal:a.kcal+(+row.querySelector('[data-field="kcal"]')?.value||0),protein:a.protein+(+row.querySelector('[data-field="protein"]')?.value||0),carbs:a.carbs+(+row.querySelector('[data-field="carbs"]')?.value||0),fat:a.fat+(+row.querySelector('[data-field="fat"]')?.value||0)}),{kcal:0,protein:0,carbs:0,fat:0});out.innerHTML=`<div><span>칼로리</span><strong>${Math.round(vals.kcal)}</strong><small>kcal</small></div><div><span>단백질</span><strong>${Math.round(vals.protein)}</strong><small>g</small></div><div><span>탄수화물</span><strong>${Math.round(vals.carbs)}</strong><small>g</small></div><div><span>지방</span><strong>${Math.round(vals.fat)}</strong><small>g</small></div>`;}
  }
}

function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
