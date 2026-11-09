const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'work/site/dist/index.html'),'utf8');
new Function(html.split('<script>')[1].split('</script>')[0]);
console.log('JS syntax OK');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4173');
 await page.locator('#startMatchBtn').click();
 assert.equal(await page.locator('.mini-cell .sub').count(),13);
 for(const cell of await page.locator('.mini-cell .sub').all())assert(await cell.isVisible());
 assert(await page.locator('#desktopBattleArena .roll-duel').isDisabled());
 await page.locator('#myCards .card').first().click();
 const before=await page.evaluate(()=>({time:state.time,selected:state.selectedCardId,cpu:state.pendingDefenseCard.id}));
 await page.locator('#myCards .card').first().click();
 assert.equal(await page.evaluate(()=>state.time),before.time,'second tap must not roll');
 assert.equal(await page.evaluate(()=>state.pendingDefenseCard.id),before.cpu);
 await page.screenshot({path:path.join(root,'outputs/mobile-duel-live.png'),fullPage:true});
 await page.locator('#desktopBattleArena .roll-duel').click();
 assert.equal(await page.evaluate(()=>state.battle.away.name),await page.evaluate(id=>state.awayCards.find(c=>c.id===id).name,before.cpu));
 assert((await page.evaluate(()=>state.time))>before.time);
 await page.locator('#desktopBattleArena .next-duel').click();
 // Force a CPU-first turn to check reveal order, not a particular random roll.
 await page.evaluate(()=>{state.shotMode=false;state.shotAttacker=null;state.turn='B';state.ball=7;state.selectedCardId=null;state.pendingCpuCard=null;renderAll();});
 const cpu=await page.evaluate(()=>({id:state.pendingCpuCard.id,name:state.pendingCpuCard.name}));
 assert((await page.locator('#desktopBattleArena .battle-side.away').innerText()).includes(cpu.name));
 await page.locator('#myCards .card').first().click();
 assert.equal(await page.evaluate(()=>state.pendingCpuCard.id),cpu.id);
 // Save selection, tab and hand position, then simulate Android reloading a killed tab.
 await page.locator('[data-tab=rival]').click();
 const saved=await page.evaluate(()=>({time:state.time,ball:state.ball,selected:state.selectedCardId,cpu:state.pendingCpuCard.id,score:JSON.stringify(state.score)}));
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#gamePanel').classList.contains('hidden'));
 assert.deepEqual(await page.evaluate(()=>({time:state.time,ball:state.ball,selected:state.selectedCardId,cpu:state.pendingCpuCard.id,score:JSON.stringify(state.score)})),saved);
 assert(await page.locator('[data-tab=rival]').evaluate(el=>el.classList.contains('active')));
 await page.locator('[data-tab=myteam]').click();
 await page.locator('#desktopBattleArena .roll-duel').click();
 assert.equal(await page.evaluate(()=>state.battle.away.name),cpu.name);
 await page.locator('#desktopBattleArena .next-duel').click();
 // CPU shot uses the already revealed shooter and the keeper is not chosen by the player.
 await page.evaluate(()=>{state.matchEnded=false;state.turn='B';state.ball=12;enterShotMode('B');renderAll();});
 const shooter=await page.evaluate(()=>state.pendingCpuCard.name);
 assert(await page.locator('#desktopBattleArena .roll-duel').isEnabled());
 await page.locator('#desktopBattleArena .roll-duel').click();
 assert.equal(await page.evaluate(()=>state.battle.away.name),shooter);
 assert.equal(await page.evaluate(()=>state.shotMode),false);
 await page.locator('#desktopBattleArena .next-duel').click();
 // Exercise full matches, including both decks being exhausted and replenished.
 await page.evaluate(()=>{
   startMatch();let turns=0;
   while(!state.matchEnded&&turns++<100){
     if(!(state.shotMode&&state.shotAttacker==='B'))selectCard(availableHomeCards()[0].id);
     playTurn();
     if(state.resultPending)nextDuel();
   }
   if(!state.matchEnded)throw new Error('Match did not finish');
   state.shotMode=true;state.shotAttacker='B';startMatch();
   if(state.shotMode||state.shotAttacker)throw new Error('Restart retained shot mode');
 });
 // A newer synchronous checkpoint wins over an older IDB record.
 await page.evaluate(async()=>{await saveQueue;state.time=42;persistMatch();await saveQueue;
   const old=await readValue('activeMatch');old.updatedAt=1;old.state.time=3;await storeValue('activeMatch',old);
 });
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#gamePanel').classList.contains('hidden'));
 assert.equal(await page.evaluate(()=>state.time),42);
 for(const width of [320,360,412]){
   await page.setViewportSize({width,height:915});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile horizontal overflow');
 }
 await page.locator('#backToMenuBtn').click();await page.reload();
 await page.waitForFunction(()=>!document.querySelector('#startMatchBtn').disabled);
 assert(await page.locator('#setupPanel').isVisible());
 await page.locator('#resumeMatchBtn').click();
 await page.waitForFunction(()=>!document.querySelector('#gamePanel').classList.contains('hidden'));
 await page.setViewportSize({width:1440,height:1000});
 assert(await page.locator('#desktopBattleArena').isVisible());
 assert(!(await page.locator('#battleArena').isVisible()));
 const pitch=await page.locator('#miniField').boundingBox();
 const duel=await page.locator('#desktopBattleArena').boundingBox();
 const hand=await page.locator('#myCards').boundingBox();
 assert(duel.y>pitch.y+pitch.height,'desktop duel below pitch');
 assert(hand.x>duel.x+duel.width,'desktop hand on right');
 await page.screenshot({path:path.join(root,'outputs/desktop-duel-live.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: select/roll separation, CPU reveal/response, shots, full match/deck reset, automatic resume/checkpoint, menu intent, mobile widths, board labels, desktop layout');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
