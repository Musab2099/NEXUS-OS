(function () {
  'use strict';
  const tiers = ['Opal', 'Quartz', 'Amethyst', 'Sapphire', 'Diamond'];
  const ranks = tiers.flatMap((tier, i) => ['III','II','I'].map((sub, j) => ({ name: tier + ' ' + sub, tier: i, min: (i * 3 + j) * 500 })));
  const keys = ['grind_log_v1','ibrahim_gym_v1','ibrahim_gym_done','gym_schedule_v1','cali_skills_v1','wellness:habits','wellness:sleep','wellness:recovery','wellness:journal'];
  let refreshPromise;
  function read(key, fallback) { try { const data = JSON.parse(localStorage.getItem(key)); return data == null ? fallback : data; } catch (_) { return fallback; } }
  function dateKey(date = new Date()) { return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0'); }
  function days(count, now = new Date()) { return Array.from({length:count},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-i);return dateKey(d);}); }
  function validDate(date) { return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= dateKey(); }
  function rows(key) { const value=read(key,[]);return Array.isArray(value)?value:[]; }
  function calculate(now = new Date()) {
    const week=days(7,now), logs=read('grind_log_v1',{}).logs || [], gym=read('ibrahim_gym_v1',{}), done=read('ibrahim_gym_done',{}), skills=read('cali_skills_v1',{});
    const workoutDays=new Set(), skillDays=new Set(), focusDays=new Set(), bonus=new Map(), seenLogs=new Set();
    Object.entries(done).forEach(([date,count])=>{if(validDate(date)&&Number(count)>0)workoutDays.add(date);});
    Object.entries(gym).forEach(([key,value])=>{const match=key.match(/^done_\d_(\d{4}-\d{2}-\d{2})$/);if(match&&value&&validDate(match[1]))workoutDays.add(match[1]);});
    Object.values(skills).forEach(skill=>(Array.isArray(skill.sessions)?skill.sessions:[]).forEach(s=>{if(validDate(s.date)&&Number(s.value)>0)skillDays.add(s.date);}));
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);if(!/^nexus_workout_\d{4}-\d{2}-\d{2}$/.test(key))continue;
      const date=key.slice(14), record=read(key,{}), data=record.data||{};
      if(validDate(date)&&(data.done || (data.finished&&Array.isArray(data.log)&&data.log.length)))workoutDays.add(date);
      (Array.isArray(data.sessions)?data.sessions:[]).forEach(session=>{if(session.finished&&session.log&&session.log.length&&validDate(date))workoutDays.add(date);});
    }
    let loggedXP=0;
    (Array.isArray(logs)?logs:[]).forEach(log=>{
      if(!log||!validDate(log.date)||!Number.isFinite(Number(log.xp))||Number(log.xp)<=0)return;
      const id=log.ts!=null?'log:'+log.ts:JSON.stringify(log);if(seenLogs.has(id))return;seenLogs.add(id);
      const workout=log.name==='Gym Workout'||/^Completed workout/.test(log.name||'');
      const habit=/All daily habits/.test(log.name||'');
      if(workout||habit) { const id=(workout?'workout:':'habits:')+log.date;bonus.set(id,Math.max(bonus.get(id)||0,Number(log.xp)));if(workout)workoutDays.add(log.date); }
      else {loggedXP+=Math.floor(Number(log.xp));if(['code','study','content','focus','other'].includes(log.cat))focusDays.add(log.date);}
    });
    workoutDays.forEach(date=>{if(!bonus.has('workout:'+date))bonus.set('workout:'+date,50);});
    skillDays.forEach(date=>bonus.set('skill:'+date,10));
    const habits=rows('wellness:habits');
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);if(!/^wellness:done:\d{4}-\d{2}-\d{2}$/.test(key))continue;
      const date=key.slice(14), completed=rows(key);
      if(validDate(date)&&habits.length&&habits.every(h=>completed.includes(h.id))&&!bonus.has('habits:'+date))bonus.set('habits:'+date,25);
    }
    ['wellness:sleep','wellness:recovery','wellness:journal'].forEach(key=>rows(key).forEach(row=>{if(validDate(row.date)&&(key!=='wellness:sleep'||Number(row.dur)>0)&&(key!=='wellness:journal'||String(row.content||'').trim()))bonus.set(key+':'+row.date,5);}));
    const totalXP=Math.floor(loggedXP+Array.from(bonus.values()).reduce((a,b)=>a+b,0));
    const rankIndex=Math.min(ranks.length-1,Math.floor(totalXP/500)), schedule=read('gym_schedule_v1',[1,2,4,5]);
    const target=Array.isArray(schedule)&&schedule.length?new Set(schedule).size:4;
    const habitCount=week.reduce((sum,date)=>sum+habits.filter(h=>rows('wellness:done:'+date).includes(h.id)).length,0);
    function attr(name,count,target,unit) {return {name,count,target,unit,score:target?Math.round(Math.min(1,count/target)*100):0};}
    const attributes=[attr('Training',week.filter(d=>workoutDays.has(d)).length,target,'workout days'),attr('Focus',week.filter(d=>focusDays.has(d)).length,5,'productive days'),attr('Discipline',habitCount,habits.length*7,'habit completions'),attr('Skill practice',week.filter(d=>skillDays.has(d)).length,3,'practice days')];
    return {totalXP,level:Math.floor(totalXP/500)+1,xpIntoLevel:totalXP%500,rankIndex,rank:ranks[rankIndex],nextRank:ranks[rankIndex+1]||null,attributes,ovr:Math.round(attributes.reduce((sum,a)=>sum+a.score,0)/4),loggedXP,bonusXP:totalXP-loggedXP};
  }
  async function refresh() {
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      const nx=window.NexusSync;
      if(nx) {
        await Promise.all(keys.map(key=>nx.load(key)));
        await Promise.all(days(30).map(date=>nx.load('wellness:done:'+date)));
        if(window.NexusWorkoutStore)await Promise.all(days(30).map(date=>window.NexusWorkoutStore.load(date)));
      }
      const state=calculate();window.dispatchEvent(new CustomEvent('nexus-progression-change',{detail:state}));return state;
    })().finally(()=>{refreshPromise=null;});return refreshPromise;
  }
  function gem(tier) {
    const points=['32,5 55,20 51,44 32,59 13,44 9,20','32,3 53,15 58,35 32,61 6,35 11,15','32,2 55,18 50,47 32,62 14,47 9,18','32,2 59,24 45,55 19,55 5,24','32,2 58,18 54,42 32,62 10,42 6,18'][tier]||'32,5 55,20 32,59 9,20';
    return '<svg class="rank-gem gem-tier-'+tier+'" viewBox="0 0 64 64" aria-hidden="true"><polygon points="'+points+'" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="2"/><path d="M9 20 32 25 55 20M32 5 32 25 13 44M32 25 51 44M32 25 32 59" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m32 10 10 11-10 5-10-5Z" fill="currentColor" opacity=".65"/></svg>';
  }
  function render() {
    const host=document.getElementById('progressionInsights');if(!host)return;
    const state=calculate();
    host.innerHTML='<div class="insight-overview">'+gem(state.rank.tier)+'<div><div class="card-eyebrow">Overall insights · last 7 days</div><div class="insight-score">'+state.ovr+' <small>OVR</small></div><strong>'+state.rank.name+'</strong><p>Level '+state.level+' · '+state.totalXP.toLocaleString()+' XP</p></div></div><div class="attribute-grid">'+state.attributes.map(a=>'<div class="attribute"><div class="attribute-title"><strong>'+a.name+'</strong><span>'+a.score+'/100</span></div><div class="ovr-xp-track"><div style="width:'+a.score+'%" class="attribute-fill"></div></div><p>'+a.count+' / '+a.target+' '+a.unit+'</p></div>').join('')+'</div><p class="progression-note">OVR is the equal average of these four scores. Targets cap at 100; no logs means zero. XP is lifetime logged activity, not a measure of health or strength.</p>';
    const ladder=document.getElementById('rankLadder');
    if(ladder)ladder.innerHTML=ranks.map((rank,i)=>'<li class="rank-row'+(i===state.rankIndex?' is-current':'')+'"'+(i===state.rankIndex?' aria-current="step"':'')+'>'+gem(rank.tier)+'<div><strong>'+rank.name+'</strong><span>'+rank.min.toLocaleString()+' XP'+(i===state.rankIndex?' · Current rank':'')+'</span></div><span class="rank-state">'+(i<state.rankIndex?'Earned':i===state.rankIndex?'You are here':'Locked')+'</span></li>').join('');
    const total=document.getElementById('xpTotal'), name=document.getElementById('rankName'), fill=document.getElementById('xpBarFill');
    if(total)total.textContent=state.totalXP.toLocaleString();if(name)name.textContent=state.rank.name;if(fill)fill.style.width=state.xpIntoLevel/5+'%';
    const left=document.getElementById('xpBarLeft'),right=document.getElementById('xpBarRight');
    if(left)left.textContent=state.xpIntoLevel+' / 500 XP';if(right)right.textContent=(500-state.xpIntoLevel)+' XP to level '+(state.level+1);
  }
  window.NexusProgression={ranks,calculate,refresh,gem,render,dateKey,days};
  window.addEventListener('nexus-progression-change',render);
  window.addEventListener('storage',render);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();refresh();});else {render();refresh();}
})();
