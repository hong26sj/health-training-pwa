import assert from 'node:assert/strict';
import {demoHealthSnapshot,normalizeHealthSnapshot} from '../js/health-model.js';
import {calculateSleep,calculateRecovery,calculateStress,calculateEnergy,calculateTraining,deriveDashboardFromHealth} from '../js/health-engine.js';

const snapshot=normalizeHealthSnapshot(demoHealthSnapshot);
const sleep=calculateSleep(snapshot);
const recovery=calculateRecovery(snapshot,sleep);
const stress=calculateStress(snapshot,sleep);
const energy=calculateEnergy(snapshot,recovery,stress);
const training=calculateTraining(snapshot,recovery);
const dashboard=deriveDashboardFromHealth(snapshot,{});

for(const [name,value] of Object.entries({sleep:sleep.score,recovery:recovery.score,stress:stress.score,energy:energy.score,training:training.score})){
  assert.ok(Number.isFinite(value),`${name} score must be numeric`);
  assert.ok(value>=0&&value<=100,`${name} score must stay within 0..100`);
}
assert.equal(dashboard.today.vitals.hrv,37.1);
assert.equal(dashboard.today.vitals.rhr,65);
assert.equal(dashboard.healthRaw.workouts[0].distanceKm,3.24);
assert.ok(Number.isFinite(dashboard.training.atl));
assert.ok(Number.isFinite(dashboard.training.ctl));
console.log('health engine smoke test passed',{
  sleep:sleep.score,recovery:recovery.score,stress:stress.score,energy:energy.score,training:training.score,
  atl:dashboard.training.atl,ctl:dashboard.training.ctl,tsb:dashboard.training.tsb
});
