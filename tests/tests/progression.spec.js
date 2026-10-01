import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.route('**/scripts/sync.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.NexusSync={USER_ID:"nexus-ibrahim",load:async()=>({data:null}),hydrate:async()=>null,save:async()=>({ok:true}),getStatus:()=>"offline",onStatusChange:()=>()=>{}};'}));
});
test('live workout snapshots muscle labels and retains a second session', async ({page}) => {
  await page.goto('/live-workout.html');
  await page.evaluate(async () => {
    selectDay('monday'); startWorkout();
    S.exIdx = 4; renderTracker(); completeSet(); closeRest();
    await persistWorkoutState();
    const first = S.sessionId;
    const date = localWorkoutDateKey();
    await persistWorkoutState({finished:true,session:buildFinishedSession()});
    selectDay('tuesday'); startWorkout();
    S.exIdx = 3; renderTracker(); completeSet(); closeRest();
    await persistWorkoutState();
    window.testWorkout = {first,date};
  });
  const sessions = await page.evaluate(() => NexusWorkoutStore.readLocal(window.testWorkout.date).data.sessions);
  expect(sessions).toHaveLength(2);
  expect(sessions[0].log[0].muscles).toEqual(['Chest','Shoulders']);
  expect(sessions[1].log[0].muscles).toEqual(['Lats','Biceps']);
  expect(sessions[0].finished).toBe(true);
});
for(const width of [390,1280])test(`progression ladder and insights at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.goto('/grind-log.html');
  await expect(page.locator('#rankLadder .rank-row')).toHaveCount(15);
  await expect(page.locator('#rankLadder [aria-current="step"]')).toContainText('Opal III');
  await page.evaluate(()=>{const date=window.NexusProgression.dateKey();localStorage.setItem('grind_log_v1',JSON.stringify({logs:[{name:'Built feature',xp:1500,cat:'code',date,ts:1}]}));window.NexusProgression.render();});
  await expect(page.locator('#rankLadder [aria-current="step"]')).toContainText('Quartz III');
  await expect(page.locator('#xpTotal')).toHaveText('1,500');
  await expect(page.locator('.attribute')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('#rankLadder [aria-current="step"]')).toContainText('Quartz III');
  await page.goto('/index.html');
  await expect(page.locator('#ovrRank')).toContainText('Quartz III');
  await expect(page.locator('#ovrTotalXp')).toHaveText('1,500 XP earned');
  await expect(page.locator('#pulseScore')).toHaveText('5');
  await expect(page.locator('#ovrGem svg')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
