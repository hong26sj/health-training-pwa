const DEMO_KEY='healthTrainingDemoData';
const GAS_URL_KEY='healthTrainingGasUrl';

const defaultDemo={
  updatedAt:new Date().toISOString(),
  today:{
    recovery:{score:84,status:'최고 상태',hrv:37,hrvBaseline:30,rhr:65,rhrBaseline:71,trend:[31,33,29,37,34,39,37]},
    stress:{score:73,status:'주의 스트레스',avg:21,avgBaseline:38,rhr:65,trend:[28,31,46,33,39,25,21]},
    energy:{score:65,status:'보통',overnightCharge:60,dayDrain:28,rangeMin:33,rangeMax:94,trend:[42,51,73,94,87,78,71,65]},
    training:{score:24,status:'낮음',targetMin:67,targetMax:88,calories:829,recovery:84},
    sleep:{minutes:562,quality:70,targetMinutes:450,avg14Quality:68,deep:74,rem:112,efficiency:91,consistency:72},
    vitals:{vo2max:36.2,hrv:37.1,rhr:56,resp:16,spo2:97,weight:80.1,bmi:26.8,bodyFat:27.4,leanMass:58.2}
  },
  training:{atl:43.8,ctl:29.9,tsb:1.46,zone0:36,focusLow:94,focusHigh:6,focusAnaerobic:0,hrRecovery:27},
  strength:{recent:[
    {date:'2026-09-05',name:'체스트프레스',summary:'50kg × 10회 × 3세트'},
    {date:'2026-09-05',name:'랫풀다운',summary:'45kg × 10회 × 3세트'},
    {date:'2026-09-04',name:'숄더프레스',summary:'30kg × 10회 × 3세트'}
  ]},
  nutrition:{
    goals:{kcal:2100,protein:150,carbs:230,fat:60},
    meals:[
      {id:'demo-1',date:'2026-09-06',time:'07:30',type:'아침',title:'운동 후 아침',photos:[],note:'',tags:['운동 후'],items:[
        {id:'i1',name:'닭가슴살',amount:'150g',kcal:165,protein:31,carbs:0,fat:3.6},
        {id:'i2',name:'바나나',amount:'1개',kcal:105,protein:1.3,carbs:27,fat:.4},
        {id:'i3',name:'알배추',amount:'5장',kcal:25,protein:1.4,carbs:5,fat:.2}
      ]},
      {id:'demo-2',date:'2026-09-06',time:'12:20',type:'점심',title:'구내식당 점심',photos:[],note:'',tags:['구내식당'],items:[
        {id:'i4',name:'백반',amount:'1인분',kcal:690,protein:32,carbs:91,fat:20}
      ]},
      {id:'demo-3',date:'2026-09-06',time:'18:40',type:'저녁',title:'저녁 식사',photos:[],note:'',tags:[],items:[
        {id:'i5',name:'현미밥',amount:'1공기',kcal:300,protein:6,carbs:64,fat:2},
        {id:'i6',name:'닭가슴살',amount:'150g',kcal:165,protein:31,carbs:0,fat:3.6},
        {id:'i7',name:'김치·채소',amount:'1접시',kcal:45,protein:2,carbs:9,fat:.5}
      ]}
    ]
  }
};

function clone(v){return JSON.parse(JSON.stringify(v));}
function mealTotals(meal){
  const items=Array.isArray(meal.items)?meal.items:[];
  return items.reduce((a,x)=>({kcal:a.kcal+(+x.kcal||0),protein:a.protein+(+x.protein||0),carbs:a.carbs+(+x.carbs||0),fat:a.fat+(+x.fat||0)}),{kcal:0,protein:0,carbs:0,fat:0});
}
function migrateMeal(m){
  if(Array.isArray(m.items)) return {...m,photos:Array.isArray(m.photos)?m.photos:[],tags:Array.isArray(m.tags)?m.tags:[],title:m.title||m.name||m.type||'식사',note:m.note||''};
  return {id:m.id||`meal-${Date.now()}`,date:m.date,time:m.time,type:m.type||'간식',title:m.name||m.type||'식사',photos:[],note:'',tags:[],items:[{id:`item-${Date.now()}`,name:m.name||'식사',amount:'1회',kcal:+m.calories||0,protein:+m.protein||0,carbs:+m.carbs||0,fat:+m.fat||0}]};
}
function ensureShape(data){
  const d=data||clone(defaultDemo);
  if(!d.nutrition)d.nutrition=clone(defaultDemo.nutrition);
  if(d.nutrition.goal&&!d.nutrition.goals){d.nutrition.goals={kcal:+d.nutrition.goal.calories||2100,protein:+d.nutrition.goal.protein||150,carbs:+d.nutrition.goal.carbs||230,fat:+d.nutrition.goal.fat||60};delete d.nutrition.goal;}
  if(!d.nutrition.goals)d.nutrition.goals=clone(defaultDemo.nutrition.goals);
  if(!Array.isArray(d.nutrition.meals))d.nutrition.meals=[];
  d.nutrition.meals=d.nutrition.meals.map(migrateMeal);
  d.updatedAt=d.updatedAt||new Date().toISOString();
  return d;
}

export function getGasUrl(){return localStorage.getItem(GAS_URL_KEY)||'';}
export function setGasUrl(url){if(url)localStorage.setItem(GAS_URL_KEY,url.trim());else localStorage.removeItem(GAS_URL_KEY);}
export async function loadDashboard(){const cached=localStorage.getItem(DEMO_KEY);return ensureShape(cached?JSON.parse(cached):clone(defaultDemo));}
export function saveLocalDashboard(data){data.updatedAt=new Date().toISOString();localStorage.setItem(DEMO_KEY,JSON.stringify(ensureShape(data)));}
export function nutritionSummary(data,date=new Date().toISOString().slice(0,10)){
  const d=ensureShape(data); const meals=d.nutrition.meals.filter(x=>x.date===date).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const totals=meals.reduce((a,m)=>{const t=mealTotals(m);return {kcal:a.kcal+t.kcal,protein:a.protein+t.protein,carbs:a.carbs+t.carbs,fat:a.fat+t.fat};},{kcal:0,protein:0,carbs:0,fat:0});
  return {...totals,meals,goals:d.nutrition.goals};
}
export function upsertMeal(data,meal){
  const d=ensureShape(data); const next={...meal,id:meal.id||crypto?.randomUUID?.()||`meal-${Date.now()}`,photos:Array.isArray(meal.photos)?meal.photos:[],tags:Array.isArray(meal.tags)?meal.tags:[],items:Array.isArray(meal.items)?meal.items:[]};
  const idx=d.nutrition.meals.findIndex(x=>x.id===next.id); if(idx>=0)d.nutrition.meals[idx]=next;else d.nutrition.meals.push(next); saveLocalDashboard(d); return d;
}
export function deleteMeal(data,id){const d=ensureShape(data);d.nutrition.meals=d.nutrition.meals.filter(x=>x.id!==id);saveLocalDashboard(d);return d;}
export function setNutritionGoals(data,goals){const d=ensureShape(data);d.nutrition.goals={...d.nutrition.goals,...Object.fromEntries(Object.entries(goals).map(([k,v])=>[k,+v||0]))};saveLocalDashboard(d);return d;}
export {mealTotals};

export async function loadStrengthFromExistingApi(){
  const url=getGasUrl(); if(!url)return null;
  try{const token=localStorage.getItem('workoutLoggerAuthToken')||'';const res=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'list',auth_token:token}),redirect:'follow'});const json=await res.json();if(!json?.ok||!Array.isArray(json.sessions))return null;return json.sessions;}catch(_){return null;}
}
export async function refreshRemote(){
  const data=await loadDashboard(); const sessions=await loadStrengthFromExistingApi();
  if(sessions){data.strength.recent=sessions.slice(-8).reverse().flatMap(s=>(s.exercises||[]).slice(0,3).map(ex=>({date:(s.workout_date||s.started_at||'').slice(0,10),name:ex.exercise||'운동',summary:ex.record_type==='timed'?`${ex.seconds||0}초 × ${ex.sets||0}세트`:`${ex.weight_kg||0}kg × ${ex.reps||0}회 × ${ex.sets||0}세트`}))).slice(0,8);}
  saveLocalDashboard(data); return data;
}
