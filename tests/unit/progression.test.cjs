const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function setup(data={}) {const values=new Map(Object.entries(data).map(([k,v])=>[k,JSON.stringify(v)]));const context={console,Date,Map,Set,Math,JSON,Promise,CustomEvent:class{},window:{addEventListener(){},dispatchEvent(){}},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},localStorage:{getItem:k=>values.get(k)||null,key:i=>Array.from(values.keys())[i],get length(){return values.size;}}};vm.runInNewContext(fs.readFileSync('src/scripts/progression.js','utf8'),context);return context.window.NexusProgression;}
test('muscle map is unranked without snapshots and excludes warmups/unknown legacy sets',()=>{
  const today=setup().dateKey();
  const session={sessionId:'one',log:[{exId:'a',set:1,ts:1,reps:8,muscles:['Chest','Shoulders']},{exId:'a',set:1,ts:1,reps:8,muscles:['Chest']},{exId:'b',set:1,reps:8,muscles:['Chest'],isWarmup:true},{exId:'c',set:1,reps:8}]};
  const data=setup({['nexus_workout_'+today]:{data:{...session,sessions:[session]}}}).calculateMuscles();
  assert.equal(data.groups.find(g=>g.name==='Chest').sets,1);
  assert.equal(data.groups.find(g=>g.name==='Chest').rank.name,'Opal III');
  assert.equal(data.groups.find(g=>g.name==='Back').rank,null);
  assert.equal(data.unclassified,1);
  assert.ok(setup().calculateMuscles().groups.every(g=>g.rank===null));
});
test('rank boundaries and max rank are exact',()=>{
  const date='2026-09-28', now=new Date(date+'T12:00:00');
  for(const [xp,name] of [[0,'Opal III'],[499,'Opal III'],[500,'Opal II'],[1499,'Opal I'],[1500,'Quartz III'],[6000,'Diamond III'],[7000,'Diamond I'],[9000,'Diamond I']]) {
    const state=setup({grind_log_v1:{logs:[{name:'work',date,xp,ts:1}]}}).calculate(now);
    assert.equal(state.rank.name,name); if(xp>=7000)assert.equal(state.nextRank,null);
  }
});
test('all XP sources dedupe by date with fixed fixtures',()=>{
  const date='2026-09-28', now=new Date(date+'T12:00:00');
  const data={grind_log_v1:{logs:[{name:'Work',xp:100,date,ts:1},{name:'Work',xp:100,date,ts:1},{name:'Gym Workout',xp:50,date,ts:2},{name:'All daily habits',xp:25,date,ts:3},{name:'All daily habits',xp:25,date,ts:4}]},ibrahim_gym_done:{[date]:1},['nexus_workout_'+date]:{data:{sessions:[{source:'gym',done:true},{finished:true,log:[{reps:8}]}]}},'wellness:habits':[{id:'a'}],['wellness:done:'+date]:['a','a'],cali_skills_v1:{a:{sessions:[{date,value:10},{date,value:20}]}},'wellness:sleep':[{date,dur:8},{date,dur:7}],'wellness:recovery':[{date}],'wellness:journal':[{date,content:'Actual entry'}]};
  assert.equal(setup(data).calculate(now).totalXP,200);
});
test('retained Gym completion survives a new unfinished live session',()=>{
  const date=setup().dateKey(); const state=setup({['nexus_workout_'+date]:{data:{source:'live',finished:false,log:[],sessions:[{source:'gym',done:true}]}}}).calculate();
  assert.equal(state.totalXP,50);
});
test('zero targets and null rows do not throw or create fake scores',()=>{
  const state=setup({'gym_schedule_v1':[],'wellness:habits':[null],cali_skills_v1:{a:null,b:{sessions:[null]}},'wellness:sleep':[null]}).calculate();
  assert.equal(state.ovr,0);assert.equal(state.attributes[0].target,0);
  assert.ok(state.attributes.every(a=>a.score>=0&&a.score<=100));
});
test('empty progression is zero with 15 ranks',()=>{const p=setup();assert.equal(p.ranks.length,15);assert.equal(p.calculate().totalXP,0);assert.equal(p.calculate().ovr,0);assert.equal(p.calculate().rank.name,'Opal III');});
test('rank boundaries use 500 XP with uncapped levels',()=>{const today=setup().dateKey();const p=setup({grind_log_v1:{logs:[{name:'work',xp:1500,cat:'code',date:today,ts:1}]}});assert.equal(p.calculate().rank.name,'Quartz III');assert.equal(p.calculate().level,4);assert.equal(p.calculate().xpIntoLevel,0);});
test('workout evidence and legacy synergy award only one bonus per date',()=>{const today=setup().dateKey();const p=setup({grind_log_v1:{logs:[{name:'Gym Workout',xp:50,date:today,ts:1},{name:'Completed workout (Push)',xp:50,date:today,ts:2}]},ibrahim_gym_done:{[today]:1},['nexus_workout_'+today]:{data:{done:true}}});assert.equal(p.calculate().totalXP,50);assert.equal(p.calculate().attributes[0].score,25);assert.equal(p.calculate().ovr,6);});
test('four attributes saturate equally and wellness bonuses are date-deduplicated',()=>{const p0=setup(),week=p0.days(7),data={grind_log_v1:{logs:week.slice(0,5).map((date,i)=>({name:'Code',xp:20,cat:'code',date,ts:i}))},ibrahim_gym_done:Object.fromEntries(week.slice(0,4).map(d=>[d,1])),cali_skills_v1:{planche:{sessions:week.slice(0,3).map(date=>({date,value:10}))}},'wellness:habits':[{id:'a'}],'wellness:sleep':[{date:week[0],dur:8},{date:week[0],dur:8}]};week.forEach(d=>data['wellness:done:'+d]=['a']);const state=setup(data).calculate();assert.equal(state.ovr,100);assert.equal(state.totalXP,510);});
