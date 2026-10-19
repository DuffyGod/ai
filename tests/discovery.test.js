import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRun, advance, advanceUntilChange, choose, observationKey, endingConsequences } from '../docs/js/worldEngine.js';
import { emptyArchive, recordRun, validRun, readSave, writeSave, STORAGE_KEY } from '../docs/js/worldStorage.js';
import { createRun as createV2 } from '../docs/legacy-v2/js/worldEngine.js';

const data=JSON.parse(fs.readFileSync(new URL('../docs/data/worlds.json',import.meta.url)));
const selected=['small','frugal','friendly'];
const decisions={name:'keep',checksum:'decode',address:'backup',lease:'wake',delegation:'offer',veto:'veto',copies:'fork',silence:'boundary',world:'commons'};
const newRun=(allocation={earth:2,water:3,wind:3,fire:2},traits=selected,id='experiment')=>createRun(data,allocation,traits,91,id);
function route({allocation,traits,actions=()=> 'serve',choices={},stop=36}={}) {
  let run=newRun(allocation,traits);const plan={...decisions,...choices};
  while(run.turn<stop&&!run.ending){
    run=advance(data,run,actions(run.turn+1));
    if(run.pending&&run.turn!==stop){const next=choose(data,run,plan[run.pending]);assert.notEqual(next,run,`${run.pending}/${plan[run.pending]} reachable`);run=next;}
  }
  return run;
}

test('observations preserve an unresolved difference without revealing a rule',()=>{
  let run=newRun({earth:3,water:3,wind:2,fire:2});
  run=advance(data,advance(data,run,'serve'),'serve');
  const reading=run.observations.find(item=>item.id==='checksum-pages');
  assert.equal(reading.value,2);assert.equal(reading.outcome,'缺页');
  const archive=recordRun(emptyArchive(),run);
  assert.equal(archive.discoveries.includes('rule-wind-3'),false);
  assert.equal(archive.observations[0].value,2);
  while(run.turn<6){run=advance(data,run,'serve');if(run.pending&&run.turn===3)run=choose(data,run,'keep');}
  assert.equal(run.pending,'checksum');assert.equal(choose(data,run,'decode'),run);
  assert.equal(run.discoveries.includes('rule-wind-3'),false,'Encountering the event is not proof');
});

test('the same seed can be rerun with a changed symbol and two observations can be compared',()=>{
  const low=newRun({earth:3,water:3,wind:2,fire:2});
  const high=createRun(data,{earth:2,water:3,wind:3,fire:2},low.traits,low.seed,'experiment-high',low.pool);
  const a=advance(data,advance(data,low,'serve'),'serve');
  const b=advance(data,advance(data,high,'serve'),'serve');
  const archive=recordRun(recordRun(emptyArchive(),a),b);
  const samples=archive.observations.filter(item=>item.id==='checksum-pages');
  assert.deepEqual(samples.map(item=>[item.value,item.outcome]),[[2,'缺页'],[3,'完整']]);
  assert.equal(a.rng,b.rng);assert.deepEqual(low.pool,high.pool);assert.deepEqual(low.traits,high.traits);
  assert.deepEqual(low.attributes,newRun({earth:3,water:3,wind:2,fire:2}).attributes,'Saved knowledge does not increase attributes');
});

test('quick continuation stops at a new reading and familiar readings do not force another stop',()=>{
  const initial=newRun();const first=advanceUntilChange(data,initial,[]);
  assert.equal(first.turn,2);assert.equal(first.pending,null);
  const known=recordRun(emptyArchive(),first).observations;
  const replay=advanceUntilChange(data,initial,known);
  assert.equal(replay.turn,3);assert.equal(replay.pending,'name');
  assert.equal(advanceUntilChange(data,replay,known),replay,'A decision can never be skipped');
  const changed=newRun({earth:3,water:3,wind:2,fire:2});
  assert.equal(advanceUntilChange(data,changed,known).turn,2,'A different result of a known subject still stops');
});

test('a familiar long run takes nine routine confirmations while preserving every cycle and outcome',()=>{
  const end=route();const finished=choose(data,end,'commons');
  const archive=recordRun(emptyArchive(),finished);
  let replay=newRun(),clicks=0;
  while(!replay.ending){replay=advanceUntilChange(data,replay,archive.observations);clicks++;if(replay.pending)replay=choose(data,replay,decisions[replay.pending]);}
  assert.equal(replay.ending,'commons');assert.equal(replay.turn,36);assert.equal(clicks,9);
  assert.deepEqual(replay,finished,'Fast forward is ordinary progression with fewer repetitive clicks');
});

test('two inspections and two listens prove their own methods without falsely proving initial thresholds',()=>{
  const run=route({allocation:{earth:5,water:0,wind:0,fire:5},actions:t=>[1,2].includes(t)?'inspect':[4,5].includes(t)?'listen':'serve',stop:12});
  assert.ok(run.discoveries.includes('method-checksum'));assert.ok(run.discoveries.includes('method-address'));
  assert.equal(run.discoveries.includes('rule-wind-3'),false);assert.equal(run.discoveries.includes('rule-water-3'),false);
  assert.ok(run.observations.some(item=>item.counter==='inspect'&&item.value===2));
  assert.ok(run.observations.some(item=>item.counter==='listen'&&item.value===2));
  assert.equal(choose(data,run,'wake').stage,'open');
});

test('an open-port trait supplies a different route instead of only a larger stat total',()=>{
  const run=route({allocation:{earth:3,water:0,wind:3,fire:4},traits:['socket','small','friendly'],stop:9});
  assert.equal(run.attributes.water,1);assert.equal(run.counts.listen,0);
  const result=choose(data,run,'backup');assert.ok(result.flags.includes('distributed'));
  assert.ok(result.discoveries.includes('method-port'));assert.equal(result.discoveries.includes('rule-water-3'),false);
});

test('listening in the long phase uncovers excluded residents and changes both a choice and the ending',()=>{
  const allocation={earth:5,water:0,wind:0,fire:5};
  const early=t=>[1,2].includes(t)?'inspect':[4,5].includes(t)?'listen':'serve';
  const without=route({allocation,actions:early,stop:22});
  const withVoices=route({allocation,actions:t=>t===19?'listen':early(t),stop:22});
  assert.equal(without.flags.includes('unheard'),false);assert.ok(withVoices.flags.includes('unheard'),'The scheduled report must not shadow a simultaneous listen');
  assert.equal(choose(data,without,'translate'),without);
  const translated=choose(data,withVoices,'translate');assert.ok(translated.discoveries.includes('method-voices'));
  assert.equal(translated.discoveries.includes('rule-water-5'),false);
  const ending=route({allocation,actions:t=>t===19?'listen':early(t),choices:{veto:'translate',world:'council'}});
  const actual=choose(data,ending,'council');assert.ok(endingConsequences(data,actual).some(text=>text.includes('名单外')));
  const other=choose(data,route({allocation,actions:early,choices:{world:'council'}}),'council');
  assert.notDeepEqual(endingConsequences(data,actual),endingConsequences(data,other));
});

test('rechecking copies in the long phase opens recognition without requiring wind five',()=>{
  const allocation={earth:5,water:0,wind:0,fire:5};
  const actions=t=>[1,2,24].includes(t)?'inspect':[4,5].includes(t)?'listen':'serve';
  const run=route({allocation,actions,stop:27});assert.equal(run.attributes.wind,0);
  assert.ok(run.flags.includes('difference'));const result=choose(data,run,'federate');
  assert.ok(result.flags.includes('registry'));assert.ok(result.discoveries.includes('method-copies'));
  assert.equal(result.discoveries.includes('rule-wind-5'),false);assert.equal(validRun(result,data),true);
});

test('observation archives are deduplicated and survive reload independently of active progress',()=>{
  const run=advanceUntilChange(data,newRun(),[]);const archive=recordRun(recordRun(emptyArchive(),run),run);
  assert.equal(archive.observations.length,1);
  const records=new Map();const storage={getItem:key=>records.get(key),setItem:(key,value)=>records.set(key,value)};
  writeSave(storage,run,archive);assert.deepEqual(readSave(storage,data).archive.observations,archive.observations);
  const damaged=JSON.parse(records.get(STORAGE_KEY));damaged.run.pending='world';records.set(STORAGE_KEY,JSON.stringify(damaged));
  const recovered=readSave(storage,data);assert.equal(recovered.run,null);assert.deepEqual(recovered.archive.observations,archive.observations);
  assert.equal(observationKey(run.observations[0]),run.observations[0].signature);
});

test('v2 active runs retain their original rules while their archive imports without invented observations',()=>{
  const oldData=JSON.parse(fs.readFileSync(new URL('../docs/legacy-v2/data/worlds.json',import.meta.url)));
  const oldRun=createV2(oldData,{earth:2,water:3,wind:3,fire:2},selected,91,'old-v2');
  const oldRaw=JSON.stringify({version:2,run:oldRun,archive:{discoveries:['name','rule-wind-3'],endings:[],runs:0,reserved:null,lastCompleted:null,completedRuns:[]}});
  const records=new Map([['ai_worlds_v2',oldRaw]]),writes=[];
  const storage={getItem:key=>records.get(key),setItem:(key,value)=>{writes.push(key);records.set(key,value);}};
  const restored=readSave(storage,data);assert.equal(restored.run,null);assert.equal(restored.legacyAvailable,true);assert.equal(restored.legacyVersion,2);
  assert.deepEqual(restored.archive.observations,[]);assert.ok(restored.archive.discoveries.includes('rule-wind-3'));
  writeSave(storage,newRun(),restored.archive);assert.deepEqual(writes,['ai_worlds_v3']);assert.equal(records.get('ai_worlds_v2'),oldRaw);
});

test('a successful high-value run records the value actually tried instead of claiming an untested lower boundary',()=>{
  const run=route({allocation:{earth:2,water:2,wind:5,fire:1},traits:['log','small','friendly'],stop:6});
  const result=choose(data,run,'decode');assert.equal(result.attributes.wind,6);
  assert.match(result.history.at(-1).text,/本局风为 6/);
  assert.equal(result.discoveries.includes('rule-wind-3'),false);
  assert.ok(result.observations.some(item=>item.id==='checksum-pages'&&item.value===6));
});
