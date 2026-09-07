export const HEALTH_MODEL_VERSION=1;

const iso=()=>new Date().toISOString();

export function createEmptyHealthSnapshot(){
  return {
    schemaVersion:HEALTH_MODEL_VERSION,
    source:'healthkit',
    generatedAt:iso(),
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Seoul',
    period:{date:new Date().toISOString().slice(0,10)},
    vitals:{
      hrvMs:null,hrvBaselineMs:null,restingHeartRateBpm:null,restingHeartRateBaselineBpm:null,
      heartRateBpm:null,respiratoryRateBrpm:null,spo2Pct:null,vo2Max:null,
      weightKg:null,bmi:null,bodyFatPct:null,leanMassKg:null
    },
    sleep:{
      start:null,end:null,totalMinutes:null,inBedMinutes:null,awakeMinutes:null,coreMinutes:null,
      deepMinutes:null,remMinutes:null,efficiencyPct:null,consistencyPct:null,targetMinutes:480
    },
    activity:{
      steps:null,activeEnergyKcal:null,basalEnergyKcal:null,exerciseMinutes:null,standHours:null,
      distanceWalkingRunningKm:null,flightsClimbed:null
    },
    training:{
      dailyLoad:null,loadHistory:[],recommendedLoadMin:null,recommendedLoadMax:null,
      lowAerobicPct:null,highAerobicPct:null,anaerobicPct:null,heartRateRecoveryBpm:null
    },
    trends:{hrvMs:[],restingHeartRateBpm:[],stressProxy:[],energyPct:[],sleepScore:[]},
    workouts:[]
  };
}

export function normalizeHealthSnapshot(input){
  const base=createEmptyHealthSnapshot();
  const src=input&&typeof input==='object'?input:{};
  return {
    ...base,...src,
    vitals:{...base.vitals,...src.vitals},
    sleep:{...base.sleep,...src.sleep},
    activity:{...base.activity,...src.activity},
    training:{...base.training,...src.training},
    trends:{...base.trends,...src.trends},
    workouts:Array.isArray(src.workouts)?src.workouts:[]
  };
}

export const demoHealthSnapshot=normalizeHealthSnapshot({
  source:'demo-healthkit',
  period:{date:'2026-09-07'},
  vitals:{
    hrvMs:37.1,hrvBaselineMs:30,restingHeartRateBpm:65,restingHeartRateBaselineBpm:71,
    respiratoryRateBrpm:16,spo2Pct:97,vo2Max:36.2,weightKg:80.1,bmi:26.8,bodyFatPct:27.4,leanMassKg:58.2
  },
  sleep:{
    start:'2026-09-06T22:47:00+09:00',end:'2026-09-07T08:09:00+09:00',totalMinutes:562,
    inBedMinutes:618,awakeMinutes:56,coreMinutes:376,deepMinutes:74,remMinutes:112,
    efficiencyPct:91,consistencyPct:72,targetMinutes:450
  },
  activity:{steps:7320,activeEnergyKcal:829,basalEnergyKcal:1640,exerciseMinutes:42,standHours:9,distanceWalkingRunningKm:5.8},
  training:{
    dailyLoad:24,loadHistory:[21,25,27,26,31,36,24],recommendedLoadMin:67,recommendedLoadMax:88,
    lowAerobicPct:94,highAerobicPct:6,anaerobicPct:0,heartRateRecoveryBpm:27
  },
  trends:{
    hrvMs:[31,33,29,37,34,39,37.1],
    restingHeartRateBpm:[72,70,73,68,69,66,65],
    stressProxy:[28,31,46,33,39,25,21],
    energyPct:[42,51,73,94,87,78,71,65],
    sleepScore:[66,69,65,73,72,75,70]
  },
  workouts:[{
    id:'demo-run-2026-09-07',type:'indoorRunning',source:'Apple Watch',
    start:'2026-09-07T06:46:59+09:00',end:'2026-09-07T07:12:11+09:00',durationSec:1512,
    distanceKm:3.24,activeEnergyKcal:223,totalEnergyKcal:266,avgHeartRateBpm:155,maxHeartRateBpm:169,
    avgCadenceSpm:156,paceSecPerKm:465,
    heartRateZones:[
      {zone:5,pct:0,durationSec:0},{zone:4,pct:18,durationSec:266},{zone:3,pct:59,durationSec:894},
      {zone:2,pct:5,durationSec:82},{zone:1,pct:0,durationSec:0},{zone:0,pct:18,durationSec:264}
    ],
    splits:[
      {index:1,distanceKm:1,durationSec:461,paceSecPerKm:461,avgHeartRateBpm:148,avgCadenceSpm:159},
      {index:2,distanceKm:1,durationSec:469,paceSecPerKm:469,avgHeartRateBpm:154,avgCadenceSpm:156},
      {index:3,distanceKm:1,durationSec:462,paceSecPerKm:462,avgHeartRateBpm:161,avgCadenceSpm:155},
      {index:4,distanceKm:.24,durationSec:120,paceSecPerKm:500,avgHeartRateBpm:151,avgCadenceSpm:152}
    ]
  }]
});
