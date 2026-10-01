const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(seed) {
  const values=new Map(seed ? [['nexus_workout_2026-09-28',JSON.stringify(seed)]] : []);
  const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const window={localStorage};
  vm.runInNewContext(fs.readFileSync('src/scripts/workout-persistence.js','utf8'),{window,console,Date,Map,Promise});
  return window.NexusWorkoutStore;
}
test('same-day saves retain distinct sessions and update rather than duplicate',async()=>{
  const store=setup();
  await store.save('2026-09-28',{source:'live',sessionId:'one',startTs:1,finished:true,log:[{muscles:['Chest'],reps:8}]});
  await store.save('2026-09-28',{source:'live',sessionId:'two',startTs:2,finished:false,log:[]});
  await store.save('2026-09-28',{source:'live',sessionId:'two',startTs:2,finished:true,log:[{muscles:['Back'],reps:5}]});
  await store.save('2026-09-28',{source:'gym',dayIndex:0,done:true});
  const data=store.readLocal('2026-09-28').data;
  assert.equal(data.sessions.length,3);
  assert.equal(data.sessions[0].log[0].muscles[0],'Chest');
  assert.equal(data.sessions[1].log.length,1);
  assert.equal(data.sessions[1].finished,true);
});
test('legacy payloads migrate without discarding finished history',async()=>{
  const store=setup({version:1,data:{startTs:1,finished:true,log:[{exId:'a',reps:8}]}});
  await store.save('2026-09-28',{source:'live',sessionId:'new',startTs:2,log:[]});
  assert.equal(store.readLocal('2026-09-28').version,2);
  assert.equal(store.readLocal('2026-09-28').data.sessions.length,2);
});
test('rejected sync save cannot falsely report a successful local save',async()=>{
  const window={localStorage:{getItem:()=>null,setItem:()=>{throw new Error('quota');}},NexusSync:{save:async()=>{throw new Error('unavailable');}}};
  vm.runInNewContext(fs.readFileSync('src/scripts/workout-persistence.js','utf8'),{window,console,Date,Map,Promise});
  const result=await window.NexusWorkoutStore.save('2026-09-28',{startTs:1,log:[]});
  assert.equal(result.local,false);assert.ok(result.error);
});
test('cloud saves receive all retained sessions',async()=>{
  const values=new Map();let pushed;
  const window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},NexusSync:{save:async(k,data)=>{pushed=data;values.set(k,JSON.stringify(data));return {queued:true,local:true};}}};
  vm.runInNewContext(fs.readFileSync('src/scripts/workout-persistence.js','utf8'),{window,console,Date,Map,Promise});
  await window.NexusWorkoutStore.save('2026-09-28',{sessionId:'one',startTs:1,log:[]});
  const result=await window.NexusWorkoutStore.save('2026-09-28',{sessionId:'two',startTs:2,log:[]});
  assert.equal(pushed.data.sessions.length,2);assert.equal(result.queued,true);
});
