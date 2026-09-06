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
    goal:{calories:2100,protein:150,carbs:230,fat:60},
    meals:[
      {id:'demo-1',date:'2026-09-06',time:'07:30',type:'아침',name:'닭가슴살 · 바나나 · 알배추',calories:365,protein:41,carbs:39,fat:5},
      {id:'demo-2',date:'2026-09-06',time:'12:20',type:'점심',name:'구내식당',calories:690,protein:32,carbs:91,fat:20},
      {id:'demo-3',date:'2026-09-06',time:'18:40',type:'저녁',name:'현미밥 · 닭가슴살 · 김치',calories:510,protein:48,carbs:59,fat:9}
    ]
  }
};

function clone(v){return JSON.parse(JSON.stringify(v));}
function ensureShape(data){
  const d=data||clone(defaultDemo);
  if(!d.nutrition)d.nutrition=clone(defaultDemo.nutrition);
  if(!d.nutrition.goal)d.nutrition.goal=clone(defaultDemo.nutrition.goal);
  if(!Array.isArray(d.nutrition.meals))d.nutrition.meals=[];
  d.updatedAt=d.updatedAt||new Date().toISOString();
  return d;
}

export function getGasUrl(){return localStorage.getItem(GAS_URL_KEY)||'';}
export function setGasUrl(url){if(url)localStorage.setItem(GAS_URL_KEY,url.trim());else localStorage.removeItem(GAS_URL_KEY);}

export async function loadDashboard(){
  const cached=localStorage.getItem(DEMO_KEY);
  const local=cached?JSON.parse(cached):clone(defaultDemo);
  return ensureShape(local);
}

export function saveLocalDashboard(data){
  data.updatedAt=new Date().toISOString();
  localStorage.setItem(DEMO_KEY,JSON.stringify(ensureShape(data)));
}

export function addMeal(data,meal){
  const d=ensureShape(data);
  d.nutrition.meals.push({
    id:crypto?.randomUUID?.()||`meal-${Date.now()}`,
    date:meal.date||new Date().toISOString().slice(0,10),
    time:meal.time||new Date().toTimeString().slice(0,5),
    type:meal.type||'간식',
    name:(meal.name||'식사').trim(),
    calories:Number(meal.calories)||0,
    protein:Number(meal.protein)||0,
    carbs:Number(meal.carbs)||0,
    fat:Number(meal.fat)||0
  });
  saveLocalDashboard(d);
  return d;
}

export function deleteMeal(data,id){
  const d=ensureShape(data);
  d.nutrition.meals=d.nutrition.meals.filter(x=>x.id!==id);
  saveLocalDashboard(d);
  return d;
}

export function setNutritionGoal(data,goal){
  const d=ensureShape(data);
  d.nutrition.goal={...d.nutrition.goal,...Object.fromEntries(Object.entries(goal).map(([k,v])=>[k,Number(v)||0]))};
  saveLocalDashboard(d);
  return d;
}

export function nutritionSummary(data,date=new Date().toISOString().slice(0,10)){
  const d=ensureShape(data); const meals=d.nutrition.meals.filter(x=>x.date===date);
  const sum=meals.reduce((a,x)=>({calories:a.calories+x.calories,protein:a.protein+x.protein,carbs:a.carbs+x.carbs,fat:a.fat+x.fat}),{calories:0,protein:0,carbs:0,fat:0});
  return {...sum,meals};
}

export async function loadStrengthFromExistingApi(){
  const url=getGasUrl(); if(!url)return null;
  try{
    const token=localStorage.getItem('workoutLoggerAuthToken')||'';
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'list',auth_token:token}),redirect:'follow'});
    const json=await res.json();
    if(!json?.ok||!Array.isArray(json.sessions))return null;
    return json.sessions;
  }catch(_){return null;}
}

export async function refreshRemote(){
  const data=await loadDashboard();
  const sessions=await loadStrengthFromExistingApi();
  if(sessions){
    data.strength.recent=sessions.slice(-8).reverse().flatMap(s=>(s.exercises||[]).slice(0,3).map(ex=>({
      date:(s.workout_date||s.started_at||'').slice(0,10),
      name:ex.exercise||'운동',
      summary:ex.record_type==='timed'?`${ex.seconds||0}초 × ${ex.sets||0}세트`:`${ex.weight_kg||0}kg × ${ex.reps||0}회 × ${ex.sets||0}세트`
    }))).slice(0,8);
  }
  saveLocalDashboard(data);
  return data;
}
