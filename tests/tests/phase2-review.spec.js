import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const pages=['index','health','gym','progression-tab','grind-log','facescan','live-workout','offline'];
const themes=['nexus-dark','arctic-white','periwinkle'];
test.beforeEach(async({page})=>{
  await page.route('**/scripts/sync.js*',r=>r.fulfill({contentType:'application/javascript',body:`window.syncSaves=[];window.NexusSync={USER_ID:'nexus-ibrahim',load:async()=>({data:null}),hydrate:async()=>null,save:async(key,data)=>{syncSaves.push(key);localStorage.setItem(key,JSON.stringify(data));return {ok:true,local:true,queued:false};},getStatus:()=> 'synced',isOnline:()=>true,onStatusChange:()=>()=>{}};`}));
});
for(const name of pages)for(const width of [390,1280])for(const theme of themes){
  test(`${name} ${width}px ${theme}`,async({page},info)=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.setViewportSize({width,height:844});
    await page.addInitScript(t=>localStorage.setItem('nexus-theme',t),theme);
    await page.goto('/'+name+'.html');
    await page.waitForTimeout(800);
    expect(errors.filter(e=>!e.includes('net::ERR_'))).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('body')).toBeVisible();
    if(name!=='offline'&&name!=='live-workout'){
      await page.locator('[data-theme-button]').first().click();
      await expect(page.locator('[data-theme-menu]').first()).toBeVisible();
      await page.locator('[data-theme-option="'+theme+'"]').first().click();
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
      await expect(page.locator('header nav a[data-route="gym"]')).toBeAttached();
    }
    await page.screenshot({path:info.outputPath('layout.png'),fullPage:true});
  });
}
test('Gym hydration keeps explicit unchecked state and unrelated tracker history',async({page})=>{
  await page.route('**/scripts/sync.js*',r=>r.fulfill({contentType:'application/javascript',body:`
    const now=new Date(),date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    const slot=[1,2,4,5].indexOf(now.getDay());const day=slot<0?0:slot;
    const tracker={['done_'+day+'_'+date]:false,['ex_'+day+'_'+date]:[],weights:[],historicalField:'retained'};
    window.syncSaves=[];
    window.NexusSync={load:async(key)=>{if(key==='nexus_workout_'+date){const value={data:{source:'live',sessions:[{source:'gym',dayIndex:day,done:true,checked:[1]}]}};localStorage.setItem(key,JSON.stringify(value));return {data:value};}return {data:null};},hydrate:async(key)=>{if(key==='ibrahim_gym_v1')localStorage.setItem(key,JSON.stringify(tracker));},save:async(key,value)=>{syncSaves.push(key);localStorage.setItem(key,JSON.stringify(value));return {local:true,queued:false};},getStatus:()=> 'synced',onStatusChange:()=>()=>{}};`}));
  await page.goto('/gym.html');
  await expect(page.locator('#doneBtnEl')).toHaveText('Mark workout done');
  await expect(page.locator('#doneSummary strong')).toHaveText('0');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ibrahim_gym_v1')).historicalField)).toBe('retained');
});
test('default habit definitions become synced only when a habit is checked',async({page})=>{
  await page.goto('/health.html');
  expect(await page.evaluate(()=>localStorage.getItem('wellness:habits'))).toBeNull();
  await page.locator('[data-tab="habits"]').click();
  await page.locator('.habit-check').first().click();
  expect(await page.evaluate(()=>syncSaves)).toContain('wellness:habits');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wellness:habits')).length)).toBe(6);
});
test('max rank and dashboard/hub totals stay consistent',async({page})=>{
  await page.goto('/index.html');
  await page.evaluate(()=>{const date=NexusProgression.dateKey();localStorage.setItem('grind_log_v1',JSON.stringify({logs:[{name:'work',date,xp:9000,cat:'code',ts:1}]}));window.dispatchEvent(new Event('storage'));});
  await expect(page.locator('#ovrTotalXp')).toHaveText('9,000 XP earned');
  await expect(page.locator('#grindTotalXP')).toHaveText('9,000');
  await expect(page.locator('#ovrNextRank')).toHaveText('Top rank reached');
  await page.goto('/grind-log.html');
  await expect(page.locator('#xpTotal')).toHaveText('9,000');
  await expect(page.locator('#rankName')).toHaveText('Diamond I');
  await expect(page.locator('#xpBarRight')).toHaveText('Top rank reached');
});
test('dashboard quick actions save through sync and immediately update shared XP',async({page})=>{
  await page.goto('/index.html');
  await page.locator('#qaSleep').click();await page.locator('#qaMood').click();
  await expect(page.locator('#ovrTotalXp')).toHaveText('10 XP earned');
  const saves=await page.evaluate(()=>syncSaves);
  expect(saves).toContain('wellness:sleep');expect(saves).toContain('wellness:journal');
});
test('reload resumes at the next set without duplicating completed sets',async({page})=>{
  await page.goto('/live-workout.html');
  await page.evaluate(async()=>{selectDay('monday');startWorkout();S.exIdx=4;renderTracker();completeSet();closeRest();await persistWorkoutState();});
  await page.reload();
  await expect(page.locator('#set-cur')).toHaveText('2');
  expect(await page.evaluate(()=>S.log.length)).toBe(1);
});
test('set logs carry muscles, units and stable session identity; Gym retains Live data',async({page})=>{
  await page.goto('/live-workout.html');
  const result=await page.evaluate(async()=>{
    selectDay('monday');startWorkout();S.exIdx=4;renderTracker();completeSet();closeRest();
    await persistWorkoutState();const date=localWorkoutDateKey();const log=S.log[0];
    await NexusWorkoutStore.save(date,{source:'gym',dayIndex:0,done:true,checked:[1]});
    return {log,sessions:NexusWorkoutStore.readLocal(date).data.sessions,keys:syncSaves};
  });
  expect(result.log.unit).toBe('reps');expect(result.log.sessionId).toBeTruthy();expect(result.log.muscles).toEqual(['Chest','Shoulders']);
  expect(result.sessions).toHaveLength(2);expect(result.keys.some(k=>k.startsWith('nexus_workout_'))).toBe(true);
  const hold=await page.evaluate(async()=>{S.exIdx=9;renderTracker();completeSet();closeRest();await persistWorkoutState();return S.log.at(-1);});
  expect(hold.unit).toBe('sec');expect(hold.sessionId).toBe(result.log.sessionId);
});
