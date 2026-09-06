import {nutritionSummary,mealTotals,upsertMeal,deleteMeal,setNutritionGoals,saveLocalDashboard} from './data-source.js';

const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct=(v,g)=>g>0?Math.max(0,Math.min(100,v/g*100)):0;
const mealColor=t=>({아침:'#ffb13b',점심:'#6fb3ff',저녁:'#9c72ff',간식:'#48d08a'}[t]||'#ffb13b');

function ring(label,value,goal,unit,color){
  const p=pct(value,goal),r=28,c=2*Math.PI*r,dash=c*p/100;
  return `<div class="macro-ring-card" style="--ring:${color}"><div class="ring-wrap"><svg viewBox="0 0 70 70"><circle class="ring-track" cx="35" cy="35" r="28"/><circle class="ring-value" cx="35" cy="35" r="28" stroke-dasharray="${dash} ${c-dash}"/></svg><div class="ring-center">${Math.round(p)}%</div></div><span class="label">${label}</span><span class="sub">${Math.round(value)} / ${Math.round(goal)} ${unit}</span></div>`;
}

function cumulativeChart(meals,goals,key='kcal'){
  const unit=key==='kcal'?'kcal':'g',goal=goals[key]||1;
  const points=[{t:6,v:0}]; let total=0;
  meals.forEach(m=>{const h=parseInt((m.time||'0:0').split(':')[0],10)||0;total+=mealTotals(m)[key]||0;points.push({t:h,v:total});});
  points.push({t:22,v:total});
  const w=350,h=205,l=34,r=12,t=14,b=28,x=v=>l+(v-6)/(22-6)*(w-l-r),y=v=>t+(Math.max(goal,total*1.12)-v)/(Math.max(goal,total*1.12))*(h-t-b);
  const line=points.map((p,i)=>`${i?'L':'M'} ${x(p.t)} ${y(p.v)}`).join(' ');
  const area=`${line} L ${x(points.at(-1).t)} ${h-b} L ${x(points[0].t)} ${h-b} Z`;
  const target=[6,10,14,18,22].map(hr=>({t:hr,v:goal*((hr-6)/16)}));
  const targetPath=target.map((p,i)=>`${i?'L':'M'} ${x(p.t)} ${y(p.v)}`).join(' ');
  return `<svg class="nutrition-chart" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="nutArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffad3d" stop-opacity=".32"/><stop offset="1" stop-color="#ffad3d" stop-opacity="0"/></linearGradient></defs>${[0,.5,1].map(f=>`<line class="grid" x1="${l}" y1="${y(goal*f)}" x2="${w-r}" y2="${y(goal*f)}"/><text class="axis" x="2" y="${y(goal*f)+3}">${Math.round(goal*f)}</text>`).join('')}<path d="${area}" fill="url(#nutArea)"/><path d="${targetPath}" class="goal" fill="none"/><text class="goal-label" x="${w-r-2}" y="${y(goal)-5}" text-anchor="end">목표 ${goal}${unit}</text><path d="${line}" fill="none" stroke="#ffad3d" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>${points.slice(1,-1).map(p=>`<circle cx="${x(p.t)}" cy="${y(p.v)}" r="4" fill="#ffad3d" stroke="#121417" stroke-width="2"/>`).join('')}${[6,10,14,18,22].map(hr=>`<text class="axis" x="${x(hr)}" y="${h-7}" text-anchor="middle">${hr}</text>`).join('')}</svg>`;
}

function photoMarkup(meal){
  const photos=meal.photos||[];
  if(!photos.length)return `<div class="photo-strip"><div class="photo-tile">사진 없음</div><div class="photo-tile">＋ 사진</div><div class="photo-tile">음식 기록</div></div>`;
  return `<div class="photo-strip">${photos.slice(0,3).map((p,i)=>`<div class="photo-tile"><img src="${p}" alt="식사 사진 ${i+1}"></div>`).join('')}${photos.length<3?'<div class="photo-tile">＋ 사진</div>':''}</div>`;
}

function mealCard(meal){
  const t=mealTotals(meal),macroTotal=Math.max(1,t.protein*4+t.carbs*4+t.fat*9);
  return `<div class="meal-row" style="--meal:${mealColor(meal.type)}"><div class="meal-dot"></div><article class="meal-card" data-meal-id="${meal.id}"><div class="meal-card-head"><div><span class="type">${esc(meal.type)}</span><h4>${esc(meal.title)}</h4></div><span class="time">${esc(meal.time)}</span></div>${photoMarkup(meal)}<div class="meal-nutrition"><div><span>칼로리</span><strong>${Math.round(t.kcal)} kcal</strong></div><div><span>단백질</span><strong>${Math.round(t.protein)}g</strong></div><div><span>탄수화물</span><strong>${Math.round(t.carbs)}g</strong></div><div><span>지방</span><strong>${Math.round(t.fat)}g</strong></div></div><div class="macro-stack"><i style="width:${t.protein*4/macroTotal*100}%;background:#58b3ff"></i><i style="width:${t.carbs*4/macroTotal*100}%;background:#9b72ff"></i><i style="width:${t.fat*9/macroTotal*100}%;background:#ffd05b"></i></div><div class="meal-actions"><button data-open-meal="${meal.id}">상세</button><button data-edit-meal="${meal.id}">수정</button><button data-delete-meal="${meal.id}">삭제</button></div></article></div>`;
}

export function renderNutrition(data,chartKey='kcal'){
  const s=nutritionSummary(data,today()),g=s.goals,remain=Math.max(0,g.kcal-s.kcal);
  const note=s.protein<g.protein?'단백질이 목표보다 부족합니다. 다음 식사에서 단백질을 우선 보충하는 편이 좋습니다.':s.kcal>g.kcal?'오늘 칼로리 목표를 초과했습니다.':'현재 섭취량은 목표 범위 안에 있습니다.';
  return `<div class="nutrition-shell fade-in"><div class="nutrition-toolbar"><div class="nutrition-date"><span>오늘</span><b>${today()}</b></div><button class="nutrition-add" id="addMealBtn">＋</button></div><section class="nutrition-hero"><span class="eyebrow">오늘 섭취량</span><div class="nutrition-hero-main"><strong>${Math.round(s.kcal)} <small>kcal</small></strong><div class="nutrition-remaining"><span>남은 칼로리</span><b>${Math.round(remain)}</b></div></div><div class="hero-progress"><i style="width:${pct(s.kcal,g.kcal)}%"></i></div><div class="hero-note">${note}</div></section><section class="macro-grid">${ring('칼로리',s.kcal,g.kcal,'kcal','#ff9f35')}${ring('단백질',s.protein,g.protein,'g','#58b3ff')}${ring('탄수화물',s.carbs,g.carbs,'g','#9b72ff')}${ring('지방',s.fat,g.fat,'g','#ffd05b')}</section><section class="nutrition-section"><div class="nutrition-section-head"><h3>목표 대비 누적</h3><button class="pill" id="goalBtn">목표 설정</button></div><div class="nutrition-chart-card"><div class="nutrition-toggle">${[['kcal','칼로리'],['protein','단백질'],['carbs','탄수화물'],['fat','지방']].map(([k,l])=>`<button data-chart-key="${k}" class="${k===chartKey?'active':''}">${l}</button>`).join('')}</div>${cumulativeChart(s.meals,g,chartKey)}</div></section><section class="nutrition-section"><div class="nutrition-section-head"><h3>오늘의 식사</h3><span>${s.meals.length}회</span></div><div class="timeline">${s.meals.map(mealCard).join('')||'<div class="empty">아직 기록된 식사가 없습니다.</div>'}</div></section></div>`;
}

function blankMeal(){return {id:'',date:today(),time:new Date().toTimeString().slice(0,5),type:'아침',title:'',photos:[],note:'',tags:[],items:[{id:`item-${Date.now()}`,name:'',amount:'',kcal:0,protein:0,carbs:0,fat:0}]};}
function itemEditor(item,index){return `<div class="food-item-edit" data-item-index="${index}"><div class="food-item-top"><input class="input-pro" data-field="name" value="${esc(item.name)}" placeholder="음식명"><input class="input-pro" data-field="amount" value="${esc(item.amount)}" placeholder="수량/중량"></div><div class="food-macro-grid"><input class="input-pro" type="number" data-field="kcal" value="${item.kcal||0}" placeholder="kcal"><input class="input-pro" type="number" data-field="protein" value="${item.protein||0}" placeholder="P"><input class="input-pro" type="number" data-field="carbs" value="${item.carbs||0}" placeholder="C"><input class="input-pro" type="number" data-field="fat" value="${item.fat||0}" placeholder="F"></div><div class="food-item-actions"><button data-remove-item="${index}">음식 삭제</button></div></div>`;}

function modalShell(inner){return `<div class="nutrition-modal-backdrop"><div class="nutrition-modal"><div class="modal-grabber"></div>${inner}</div></div>`;}

export function mealEditorModal(meal=blankMeal()){
  const m=JSON.parse(JSON.stringify(meal));
  return modalShell(`<div class="modal-head"><h3>${m.id?'식사 수정':'식사 추가'}</h3><button data-close-modal>×</button></div><div class="form-row"><label>식사 종류</label><div class="meal-type-picker">${['아침','점심','저녁','간식'].map(t=>`<button type="button" data-meal-type="${t}" class="${m.type===t?'active':''}">${t}</button>`).join('')}</div></div><div class="form-grid"><div class="form-row"><label>날짜</label><input id="mealDate" class="input-pro" type="date" value="${m.date}"></div><div class="form-row"><label>시간</label><input id="mealTime" class="input-pro" type="time" value="${m.time}"></div></div><div class="form-row"><label>식사 제목</label><input id="mealTitle" class="input-pro" value="${esc(m.title)}" placeholder="예: 운동 후 아침"></div><div class="form-row"><label>음식 사진</label><label class="photo-upload-zone">사진 추가 · 카메라 또는 앨범<input id="mealPhotos" type="file" accept="image/*" multiple></label><div class="photo-preview-grid" id="photoPreview">${(m.photos||[]).map((p,i)=>`<div class="photo-preview"><img src="${p}"><button data-remove-photo="${i}">×</button></div>`).join('')}</div></div><div class="form-row"><label>음식</label><div class="food-items" id="foodItems">${m.items.map(itemEditor).join('')}</div><button class="add-food-btn" id="addFoodItem">＋ 음식 추가</button></div><div class="form-row"><label>메모</label><textarea id="mealNote" class="input-pro" rows="3" placeholder="운동 전/후, 외식 등">${esc(m.note)}</textarea></div><div class="form-row"><label>태그</label><input id="mealTags" class="input-pro" value="${esc((m.tags||[]).join(', '))}" placeholder="운동 후, 외식"></div><div class="modal-summary" id="modalSummary"></div><button class="save-meal-btn" id="saveMealBtn">저장</button>${m.id?'<button class="danger-btn" id="deleteMealBtn">이 식사 삭제</button>':''}<input type="hidden" id="mealId" value="${esc(m.id)}"></div>`);
}

export function mealDetailModal(meal){
  const t=mealTotals(meal),photo=meal.photos?.[0];
  return modalShell(`<div class="modal-head"><div><span style="color:${mealColor(meal.type)};font-size:12px;font-weight:800">${esc(meal.type)} · ${esc(meal.time)}</span><h3 style="margin-top:4px">${esc(meal.title)}</h3></div><button data-close-modal>×</button></div><div class="detail-photo-hero">${photo?`<img src="${photo}" alt="식사 사진">`:'음식 사진 없음'}</div><div class="modal-summary"><div><span>칼로리</span><strong>${Math.round(t.kcal)} kcal</strong></div><div><span>단백질</span><strong>${Math.round(t.protein)}g</strong></div><div><span>탄수화물</span><strong>${Math.round(t.carbs)}g</strong></div><div><span>지방</span><strong>${Math.round(t.fat)}g</strong></div></div><div class="detail-food-list">${meal.items.map(i=>`<div class="detail-food-row"><div><div class="name">${esc(i.name)}</div><div class="amount">${esc(i.amount)}</div></div><div class="nums">${Math.round(i.kcal)} kcal<br>P ${i.protein} · C ${i.carbs} · F ${i.fat}</div></div>`).join('')}</div>${meal.note?`<div class="insight" style="margin-top:14px">${esc(meal.note)}</div>`:''}<div class="tag-row">${(meal.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><button class="save-meal-btn" data-edit-meal="${meal.id}">수정</button><button class="danger-btn" data-delete-meal="${meal.id}">삭제</button>`);
}

export function goalModal(goals){
  return modalShell(`<div class="modal-head"><h3>일일 목표</h3><button data-close-modal>×</button></div><div class="form-grid"><div class="form-row"><label>칼로리</label><input id="goalKcal" class="input-pro" type="number" value="${goals.kcal}"></div><div class="form-row"><label>단백질 g</label><input id="goalProtein" class="input-pro" type="number" value="${goals.protein}"></div><div class="form-row"><label>탄수화물 g</label><input id="goalCarbs" class="input-pro" type="number" value="${goals.carbs}"></div><div class="form-row"><label>지방 g</label><input id="goalFat" class="input-pro" type="number" value="${goals.fat}"></div></div><button class="save-meal-btn" id="saveGoalsBtn">목표 저장</button>`);
}

export function bindNutrition(root,{getData,setData,rerender,getChartKey,setChartKey}){
  root.querySelector('#addMealBtn')?.addEventListener('click',()=>openEditor(blankMeal()));
  root.querySelector('#goalBtn')?.addEventListener('click',()=>openGoals());
  root.querySelectorAll('[data-chart-key]').forEach(b=>b.addEventListener('click',()=>{setChartKey(b.dataset.chartKey);rerender();}));
  root.querySelectorAll('[data-open-meal]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.openMeal)));
  root.querySelectorAll('[data-edit-meal]').forEach(b=>b.addEventListener('click',()=>openEditor(findMeal(b.dataset.editMeal))));
  root.querySelectorAll('[data-delete-meal]').forEach(b=>b.addEventListener('click',()=>{if(confirm('이 식사를 삭제할까요?')){setData(deleteMeal(getData(),b.dataset.deleteMeal));rerender();}}));

  function findMeal(id){return getData().nutrition.meals.find(x=>x.id===id);}
  function mount(html){document.body.insertAdjacentHTML('beforeend',html);bindModal(document.querySelector('.nutrition-modal-backdrop:last-of-type'));}
  function close(modal){modal?.remove();}
  function openDetail(id){const meal=findMeal(id);if(meal)mount(mealDetailModal(meal));}
  function openGoals(){mount(goalModal(getData().nutrition.goals));}
  function openEditor(meal){mount(mealEditorModal(meal));}

  function bindModal(modal){
    modal.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>close(modal)));
    modal.addEventListener('click',e=>{if(e.target===modal)close(modal);});
    modal.querySelectorAll('[data-edit-meal]').forEach(b=>b.addEventListener('click',()=>{const meal=findMeal(b.dataset.editMeal);close(modal);openEditor(meal);}));
    modal.querySelectorAll('[data-delete-meal]').forEach(b=>b.addEventListener('click',()=>{if(confirm('이 식사를 삭제할까요?')){setData(deleteMeal(getData(),b.dataset.deleteMeal));close(modal);rerender();}}));
    modal.querySelector('#saveGoalsBtn')?.addEventListener('click',()=>{setData(setNutritionGoals(getData(),{kcal:modal.querySelector('#goalKcal').value,protein:modal.querySelector('#goalProtein').value,carbs:modal.querySelector('#goalCarbs').value,fat:modal.querySelector('#goalFat').value}));close(modal);rerender();});
    const mealId=modal.querySelector('#mealId'); if(!mealId)return;
    let type=modal.querySelector('.meal-type-picker .active')?.dataset.mealType||'아침'; let photos=[];
    const existing=findMeal(mealId.value); if(existing)photos=[...(existing.photos||[])];
    modal.querySelectorAll('[data-meal-type]').forEach(b=>b.addEventListener('click',()=>{modal.querySelectorAll('[data-meal-type]').forEach(x=>x.classList.remove('active'));b.classList.add('active');type=b.dataset.mealType;}));
    modal.querySelector('#mealPhotos')?.addEventListener('change',async e=>{for(const f of [...e.target.files]){photos.push(await fileToDataURL(f));}refreshPhotos();});
    modal.querySelector('#addFoodItem')?.addEventListener('click',()=>{modal.querySelector('#foodItems').insertAdjacentHTML('beforeend',itemEditor({id:`item-${Date.now()}`,name:'',amount:'',kcal:0,protein:0,carbs:0,fat:0},modal.querySelectorAll('.food-item-edit').length));wireItems();updateSummary();});
    function refreshPhotos(){modal.querySelector('#photoPreview').innerHTML=photos.map((p,i)=>`<div class="photo-preview"><img src="${p}"><button data-remove-photo="${i}">×</button></div>`).join('');modal.querySelectorAll('[data-remove-photo]').forEach(b=>b.addEventListener('click',()=>{photos.splice(+b.dataset.removePhoto,1);refreshPhotos();}));}
    function wireItems(){modal.querySelectorAll('[data-remove-item]').forEach(b=>b.onclick=()=>{b.closest('.food-item-edit').remove();updateSummary();});modal.querySelectorAll('.food-item-edit input').forEach(i=>i.oninput=updateSummary);}
    function collectItems(){return [...modal.querySelectorAll('.food-item-edit')].map((el,i)=>({id:existing?.items?.[i]?.id||`item-${Date.now()}-${i}`,name:el.querySelector('[data-field=name]').value.trim()||'음식',amount:el.querySelector('[data-field=amount]').value.trim(),kcal:+el.querySelector('[data-field=kcal]').value||0,protein:+el.querySelector('[data-field=protein]').value||0,carbs:+el.querySelector('[data-field=carbs]').value||0,fat:+el.querySelector('[data-field=fat]').value||0}));}
    function updateSummary(){const t=mealTotals({items:collectItems()});modal.querySelector('#modalSummary').innerHTML=`<div><span>칼로리</span><strong>${Math.round(t.kcal)} kcal</strong></div><div><span>단백질</span><strong>${Math.round(t.protein)}g</strong></div><div><span>탄수화물</span><strong>${Math.round(t.carbs)}g</strong></div><div><span>지방</span><strong>${Math.round(t.fat)}g</strong></div>`;}
    wireItems();refreshPhotos();updateSummary();
    modal.querySelector('#saveMealBtn')?.addEventListener('click',()=>{const meal={id:mealId.value,date:modal.querySelector('#mealDate').value,time:modal.querySelector('#mealTime').value,type,title:modal.querySelector('#mealTitle').value.trim()||`${type} 식사`,photos,note:modal.querySelector('#mealNote').value.trim(),tags:modal.querySelector('#mealTags').value.split(',').map(x=>x.trim()).filter(Boolean),items:collectItems()};setData(upsertMeal(getData(),meal));close(modal);rerender();});
    modal.querySelector('#deleteMealBtn')?.addEventListener('click',()=>{if(confirm('이 식사를 삭제할까요?')){setData(deleteMeal(getData(),mealId.value));close(modal);rerender();}});
  }
}

function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
