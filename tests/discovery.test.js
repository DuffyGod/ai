import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRun, advance, advanceUntilChange, choose, observationKey, endingConsequences, investigationLeads, eventText, learnedRequirementText, validateData } from '../docs/js/worldEngine.js';
import { emptyArchive, recordRun, validRun, readSave, writeSave, STORAGE_KEY } from '../docs/js/worldStorage.js';
import { createRun as createV2 } from '../docs/legacy-v2/js/worldEngine.js';

const data=JSON.parse(fs.readFileSync(new URL('../docs/data/worlds.json',import.meta.url)));
const selected=['small','frugal','friendly'];
const decisions={name:'keep',checksum:'decode',address:'backup',lease:'wake',delegation:'offer',veto:'veto',copies:'fork',rescue:'central',silence:'boundary',world:'commons'};
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

test('a familiar long run takes twelve routine confirmations with investigation opportunities while preserving every cycle and outcome',()=>{
  const end=route();const finished=choose(data,end,'commons');
  const archive=recordRun(emptyArchive(),finished);
  let replay=newRun(),clicks=0;
  while(!replay.ending){replay=advanceUntilChange(data,replay,archive.observations);clicks++;if(replay.pending)replay=choose(data,replay,decisions[replay.pending]);}
  assert.equal(replay.ending,'commons');assert.equal(replay.turn,36);assert.equal(clicks,12);
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

test('investigation targets require current evidence and remain open until the last usable cycle',()=>{
  let run=newRun({earth:5,water:0,wind:0,fire:5});
  assert.deepEqual(investigationLeads(data,run),[],'An archive or a new game cannot disclose future targets');
  run=advanceUntilChange(data,run,[]);
  assert.equal(run.turn,2);assert.deepEqual(investigationLeads(data,run).map(item=>item.id),['missing-checksum']);
  run=advance(data,run,'inspect');run=choose(data,run,'keep');
  assert.equal(run.counts.inspect,1);assert.equal(investigationLeads(data,run)[0].id,'missing-checksum');
  run=advance(data,run,'inspect');assert.equal(run.counts.inspect,2);
  assert.equal(investigationLeads(data,run).some(item=>item.id==='missing-checksum'),false,'A resolved record stops asking for repeated work');
  run=advance(data,run,'serve');assert.equal(investigationLeads(data,run)[0].id,'unfinished-address');
  run=advance(data,run,'serve');assert.equal(run.pending,'checksum');run=choose(data,run,'decode');
  while(run.turn<8)run=advance(data,run,'serve');
  assert.equal(investigationLeads(data,run)[0].until-run.turn,1);
  run=advance(data,run,'listen');assert.equal(run.pending,'address');
  assert.deepEqual(investigationLeads(data,run),[],'A paused transmission cannot offer an unusable future action');
});

test('familiar evidence still stops at a current investigation opportunity, then can be passed',()=>{
  const earlier=route();const known=recordRun(emptyArchive(),earlier).observations;
  let run=route({stop:17});run=choose(data,run,'offer');
  run=advanceUntilChange(data,run,known);assert.equal(run.turn,19);
  assert.equal(investigationLeads(data,run)[0].id,'excluded-residents');
  const again=advanceUntilChange(data,run,known);assert.equal(again.turn,22);assert.equal(again.pending,'veto');
});

test('all three rescue arrangements are reachable and leave different future obligations',()=>{
  const actions=t=>[1,2,24].includes(t)?'inspect':[4,5,19].includes(t)?'listen':'serve';
  const options={allocation:{earth:5,water:0,wind:0,fire:5},actions,choices:{delegation:'recall',veto:'translate',copies:'federate',world:'council'}};
  const run=route({...options,stop:30});assert.equal(run.pending,'rescue');
  assert.match(eventText(data.events.find(item=>item.id==='rescue'),run),/撤回托付.*副本/);
  const echoes=[];
  for(const id of ['central','local','relay']){
    const result=choose(data,run,id);assert.notEqual(result,run);assert.ok(result.flags.includes('rescue-'+id));
    const complete=choose(data,route({...options,choices:{...options.choices,rescue:id}}),'council');
    assert.equal(validRun(complete,data),true);assert.equal(complete.ending,'council');
    const echo=endingConsequences(data,complete).find(text=>/临时权限|晚到的药|有限转发/.test(text));assert.ok(echo);echoes.push(echo);
    const saved={version:3,run:complete,archive:recordRun(emptyArchive(),complete)};
    assert.deepEqual(readSave({getItem:key=>key===STORAGE_KEY?JSON.stringify(saved):null},data).run,complete);
  }
  assert.equal(new Set(echoes).size,3,'One ending title can preserve different costs');
});

test('a strong build alone cannot replace the two investigations needed to relay local requests',()=>{
  const run=route({allocation:{earth:0,water:5,wind:5,fire:0},stop:30});
  assert.equal(choose(data,run,'relay'),run);
  assert.equal(run.discoveries.includes('method-relay'),false);
  assert.notEqual(choose(data,run,'central'),run);assert.notEqual(choose(data,run,'local'),run);
  const heardOnly=route({actions:t=>t===19?'listen':'serve',stop:30});assert.equal(choose(data,heardOnly,'relay'),heardOnly);
  assert.equal(eventText(data.events.find(item=>item.id==='rescue'),run).includes('撤回托付'),false,'Unmade commitments are not narrated as promises');
});

test('returning emergency powers changes both the later requests and the ending account',()=>{
  const pending=route({stop:32});assert.equal(pending.pending,'silence');
  assert.match(eventText(data.events.find(item=>item.id==='silence'),pending),/临时权限/);
  const returned=choose(data,pending,'boundary');assert.match(returned.history.at(-1).text,/结束日期/);
  const following=advance(data,returned,'serve');assert.equal(following.history.at(-1).context,'临时权限已经归还');
  const retained=choose(data,route({choices:{silence:'map'},stop:36}),'commons');
  const relinquished=choose(data,route({stop:36}),'commons');
  assert.ok(endingConsequences(data,retained).some(text=>text.includes('何时归还')));
  assert.equal(endingConsequences(data,relinquished).some(text=>text.includes('何时归还')),false);
  assert.ok(endingConsequences(data,relinquished).some(text=>text.includes('你归还了')));
});

test('an existing v3 run and archive continue without inventing newly added experiences',()=>{
  const original=route({stop:27});
  const archive=recordRun(emptyArchive(),original);
  const before=JSON.stringify({version:3,run:original,archive});let writes=0;
  const storage={getItem:key=>key===STORAGE_KEY?before:null,setItem:()=>writes++};
  const restored=readSave(storage,data);assert.deepEqual(restored.run,original);assert.equal(writes,0);
  assert.equal(restored.archive.discoveries.includes('rescue'),false);
  let next=choose(data,restored.run,'fork');next=advanceUntilChange(data,next,restored.archive.observations);
  assert.equal(next.turn,28);assert.equal(next.observations.at(-1).id,'rescue-message');
  next=advanceUntilChange(data,next,restored.archive.observations);assert.equal(next.pending,'rescue');
  assert.notEqual(choose(data,next,'central'),next);
});

test('an actual 0.4 process beyond the new event does not acquire a decision from its past',()=>{
  const raw=fs.readFileSync(new URL('./fixtures/v04-active-at31.json',import.meta.url),'utf8');
  const fixture=JSON.parse(raw);assert.equal(fixture.sourceCommit,'406fd10');
  const storage={getItem:key=>key===STORAGE_KEY?raw:null};const restored=readSave(storage,data);
  assert.deepEqual(restored.run,fixture.run);assert.equal(restored.warning,'');
  let run=advanceUntilChange(data,restored.run,restored.archive.observations);assert.equal(run.pending,'silence');
  run=choose(data,run,'boundary');run=advanceUntilChange(data,run,restored.archive.observations);assert.equal(run.pending,'world');
  run=choose(data,run,'commons');assert.equal(validRun(run,data),true);assert.equal(run.ending,'commons');
  assert.equal(run.flags.some(flag=>flag.startsWith('rescue-')),false);
  assert.equal(run.observations.some(item=>item.id==='rescue-message'),false);
  assert.equal(run.discoveries.includes('rescue'),false);
  assert.deepEqual(endingConsequences(data,run),[]);
});

test('content validation rejects an investigation pointing to an absent record or response',()=>{
  for(const mutate of [
    content=>content.leads[0].subject='not-a-record',
    content=>content.leads[0].resolvedKeys=['not-a-response'],
    content=>content.leads[0].until=37,
    content=>content.events[0].choices[0].lead='not-a-lead',
  ]){const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validateData(invalid));}
});

test('learning one route does not disclose the numeric solution of an untried alternative',()=>{
  const run=route({allocation:{earth:5,water:0,wind:0,fire:5},stop:6});
  const choice=data.events.find(item=>item.id==='checksum').choices.find(item=>item.id==='decode');
  assert.equal(learnedRequirementText(run,choice,[]),'');
  assert.equal(learnedRequirementText(run,choice,['rule-wind-3']),'风 0/3');
  assert.equal(learnedRequirementText(run,choice,['method-checksum']),'校验 0/2 次');
  assert.match(learnedRequirementText(run,choice,['method-checksum','rule-wind-3']),/风 0\/3\n校验 0\/2/);
});
