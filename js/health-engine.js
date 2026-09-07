import {normalizeHealthSnapshot} from './health-model.js';

const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:0));
const mean=arr=>{const vals=(arr||[]).map(Number).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
const ewma=(values,days)=>{const vals=(values||[]).map(Number).filter(Number.isFinite);if(!vals.length)return 0;const alpha=2/(days+1);let out=vals[0];for(let i=1;i<vals.length;i++)out=alpha*vals[i]+(1-alpha)*out;return out;};
const pct=(value,baseline,inverse=false)=>{if(!Number.isFinite(value)||!Number.isFinite(baseline)||baseline===0)return 50;const ratio=inverse?baseline/value:value/baseline;return clamp(50+(ratio-1)*180);};

export function calculateSleep(snapshot){
  const s=snapshot.sleep;
  const duration=Number(s.totalMinutes)||0,target=Math.max(1,Number(s.targetMinutes)||480);
  const durationScore=clamp(duration/target*100);
  const efficiency=clamp(Number(s.efficiencyPct)||0);
  const deepPct=duration?Number(s.deepMinutes||0)/duration*100:0;
  const remPct=duration?Number(s.remMinutes||0)/duration*100:0;
  const deepScore=clamp(100-Math.abs(deepPct-18)*4);
  const remScore=clamp(100-Math.abs(remPct-22)*3.5);
  const consistency=clamp(Number(s.consistencyPct)||0);
  const score=clamp(durationScore*.35+efficiency*.2+deepScore*.1+remScore*.15+consistency*.2);
  return {score:Math.round(score),durationScore,efficiency,deepPct,remPct,consistency};
}

export function calculateRecovery(snapshot,sleepResult=calculateSleep(snapshot)){
  const v=snapshot.vitals;
  const hrv=pct(Number(v.hrvMs),Number(v.hrvBaselineMs));
  const rhr=pct(Number(v.restingHeartRateBpm),Number(v.restingHeartRateBaselineBpm),true);
  const load=clamp(100-(Number(snapshot.training.dailyLoad)||0)*.45);
  const score=clamp(hrv*.35+rhr*.2+sleepResult.score*.3+load*.15);
  const status=score>=80?'최고 상태':score>=65?'좋은 상태':score>=45?'보통':'회복 필요';
  return {score:Math.round(score),status,hrvScore:hrv,rhrScore:rhr,loadScore:load};
}

export function calculateStress(snapshot,sleepResult=calculateSleep(snapshot)){
  const v=snapshot.vitals;
  const hrvPenalty=100-pct(Number(v.hrvMs),Number(v.hrvBaselineMs));
  const rhrPenalty=100-pct(Number(v.restingHeartRateBpm),Number(v.restingHeartRateBaselineBpm),true);
  const sleepPenalty=100-sleepResult.score;
  const loadPenalty=clamp((Number(snapshot.training.dailyLoad)||0)*1.25);
  const score=clamp(hrvPenalty*.35+rhrPenalty*.25+sleepPenalty*.2+loadPenalty*.2);
  const status=score>=75?'높은 스트레스':score>=55?'주의 스트레스':score>=30?'보통':'낮은 스트레스';
  return {score:Math.round(score),status};
}

export function calculateEnergy(snapshot,recoveryResult=calculateRecovery(snapshot),stressResult=calculateStress(snapshot)){
  const active=Number(snapshot.activity.activeEnergyKcal)||0;
  const steps=Number(snapshot.activity.steps)||0;
  const load=Number(snapshot.training.dailyLoad)||0;
  const overnightCharge=clamp(recoveryResult.score*.72+(100-stressResult.score)*.28);
  const dayDrain=clamp(active/28+steps/750+load*.35,0,80);
  const score=clamp(overnightCharge-dayDrain*.45+20);
  const status=score>=80?'높음':score>=55?'보통':score>=35?'낮음':'매우 낮음';
  return {score:Math.round(score),status,overnightCharge:Math.round(overnightCharge),dayDrain:Math.round(dayDrain)};
}

export function calculateTraining(snapshot,recoveryResult=calculateRecovery(snapshot)){
  const history=Array.isArray(snapshot.training.loadHistory)?snapshot.training.loadHistory:[];
  const today=Number(snapshot.training.dailyLoad)||0;
  const series=history.length?history:[today];
  const atl=ewma(series.slice(-14),7),ctl=ewma(series.slice(-56),42),tsb=ctl-atl;
  const targetMin=Number(snapshot.training.recommendedLoadMin)||Math.round(clamp(recoveryResult.score*.72));
  const targetMax=Number(snapshot.training.recommendedLoadMax)||Math.round(clamp(recoveryResult.score*1.05));
  const score=clamp(today);
  const status=score<targetMin?'낮음':score<=targetMax?'목표 범위':'높음';
  return {score:Math.round(score),status,targetMin,targetMax,atl:Number(atl.toFixed(1)),ctl:Number(ctl.toFixed(1)),tsb:Number(tsb.toFixed(1))};
}

export function deriveDashboardFromHealth(input,existing={}){
  const h=normalizeHealthSnapshot(input);
  const sleep=calculateSleep(h);
  const recovery=calculateRecovery(h,sleep);
  const stress=calculateStress(h,sleep);
  const energy=calculateEnergy(h,recovery,stress);
  const training=calculateTraining(h,recovery);
  const v=h.vitals,t=h.trends;
  return {
    ...existing,
    updatedAt:h.generatedAt||new Date().toISOString(),
    healthRaw:h,
    today:{
      ...(existing.today||{}),
      recovery:{score:recovery.score,status:recovery.status,hrv:Number(v.hrvMs||0),hrvBaseline:Number(v.hrvBaselineMs||0),rhr:Number(v.restingHeartRateBpm||0),rhrBaseline:Number(v.restingHeartRateBaselineBpm||0),trend:(t.hrvMs||[]).slice(-7)},
      stress:{score:stress.score,status:stress.status,avg:Math.round(mean(t.stressProxy)||stress.score),avgBaseline:Math.round(mean((t.stressProxy||[]).slice(-14))||stress.score),rhr:Number(v.restingHeartRateBpm||0),trend:(t.stressProxy||[]).slice(-7)},
      energy:{score:energy.score,status:energy.status,overnightCharge:energy.overnightCharge,dayDrain:energy.dayDrain,rangeMin:Math.min(...((t.energyPct||[]).length?t.energyPct:[energy.score])),rangeMax:Math.max(...((t.energyPct||[]).length?t.energyPct:[energy.score])),trend:(t.energyPct||[]).slice(-8)},
      training:{score:training.score,status:training.status,targetMin:training.targetMin,targetMax:training.targetMax,calories:Number(h.activity.activeEnergyKcal||0),recovery:recovery.score},
      sleep:{minutes:Number(h.sleep.totalMinutes||0),quality:sleep.score,targetMinutes:Number(h.sleep.targetMinutes||480),avg14Quality:Math.round(mean(t.sleepScore)||sleep.score),deep:Number(h.sleep.deepMinutes||0),rem:Number(h.sleep.remMinutes||0),efficiency:Number(h.sleep.efficiencyPct||0),consistency:Number(h.sleep.consistencyPct||0)},
      vitals:{vo2max:Number(v.vo2Max||0),hrv:Number(v.hrvMs||0),rhr:Number(v.restingHeartRateBpm||0),resp:Number(v.respiratoryRateBrpm||0),spo2:Number(v.spo2Pct||0),weight:Number(v.weightKg||0),bmi:Number(v.bmi||0),bodyFat:Number(v.bodyFatPct||0),leanMass:Number(v.leanMassKg||0)}
    },
    training:{
      ...(existing.training||{}),atl:training.atl,ctl:training.ctl,tsb:training.tsb,
      zone0:Number(existing.training?.zone0||0),focusLow:Number(h.training.lowAerobicPct||0),
      focusHigh:Number(h.training.highAerobicPct||0),focusAnaerobic:Number(h.training.anaerobicPct||0),
      hrRecovery:Number(h.training.heartRateRecoveryBpm||0)
    }
  };
}
