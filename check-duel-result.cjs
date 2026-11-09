const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('#startMatchBtn').click();
 const ownGoal=await page.locator('[data-cell-key="12"]').boundingBox();
 const rivalGoal=await page.locator('[data-cell-key="0"]').boundingBox();
 assert(ownGoal.x<rivalGoal.x,'own goal must be on the left');
 assert((await page.locator('.mini-cell').first().getAttribute('aria-label')).startsWith('Tu portería'));
 await page.evaluate(()=>{
   currentCenterStat='ritmo';BOARD=buildBoard(currentCenterStat);
   state.homeCards[0].ritmo=8;state.awayCards.forEach(c=>c.ritmo=7);renderAll();
 });
 await page.evaluate(()=>selectCard(state.homeCards[0].id));
 const names=await page.evaluate(()=>[getSelectedCard().name,state.pendingDefenseCard.name]);
 await page.evaluate(()=>{const old=d6;const rolls=[5,3];d6=()=>rolls.shift();playTurn();d6=old;});
 assert.equal(await page.evaluate(()=>state.duelPhase),'rolling');
 assert.equal(await page.evaluate(()=>state.ball),3);
 assert.equal(await page.evaluate(()=>state.duelVisualBall),6);
 assert((await page.locator('#desktopBattleArena').innerText()).includes(names[0]));
 assert((await page.locator('#desktopBattleArena').innerText()).includes(names[1]));
 assert(!(await page.locator('#desktopBattleArena').innerText()).includes('13 − 10'));
 const resolved=await page.evaluate(()=>JSON.stringify({time:state.time,battle:state.battle,score:state.score}));
 await page.evaluate(()=>{selectCard(availableHomeCards()[0].id);playTurn();nextDuel();});
 assert.equal(await page.evaluate(()=>JSON.stringify({time:state.time,battle:state.battle,score:state.score})),resolved,'blocked input cannot consume another turn');
 await page.evaluate(()=>{
   window.ballSteps=[];new MutationObserver(()=>{
     const label=document.querySelector('.mini-cell.active')?.getAttribute('aria-label');
     if(label&&ballSteps.at(-1)!==label)ballSteps.push(label);
   }).observe(document.querySelector('#miniField'),{childList:true});
 });
 await page.waitForFunction(()=>state.duelPhase==='result');
 assert.equal(await page.evaluate(()=>state.duelVisualBall),3);
 assert((await page.locator('[data-cell-key="3"]').boundingBox()).x>(await page.locator('[data-cell-key="6"]').boundingBox()).x,'home win moves right');
 for(const cell of ['A2','A3','A4'])assert((await page.evaluate(()=>ballSteps)).some(s=>s.startsWith(cell)));
 assert((await page.locator('#desktopBattleArena').innerText()).includes('13 − 10 = 3 · Avanzas 3 casillas'));
 assert.equal(await page.locator('#desktopBattleArena .pip-dot').count(),8);
 assert(await page.locator('#desktopBattleArena .next-duel').isEnabled());
 assert(await page.locator('#myCards').evaluate(e=>e.inert));
 await page.screenshot({path:path.join(__dirname,'outputs/mobile-result-v6.png'),fullPage:true});
 const completed=await page.evaluate(()=>JSON.stringify({battle:state.battle,score:state.score,time:state.time},(k,v)=>k==='photo_data'?undefined:v));
 await page.reload();await page.waitForFunction(()=>state.resultPending&&state.duelPhase==='result');
 assert.equal(await page.evaluate(()=>JSON.stringify({battle:state.battle,score:state.score,time:state.time},(k,v)=>k==='photo_data'?undefined:v)),completed);
 await page.locator('#desktopBattleArena .next-duel').click();
 assert.equal(await page.evaluate(()=>state.resultPending),false);
 assert(!(await page.locator('#myCards').evaluate(e=>e.inert)));
 // CPU attacks first: reveal before selection and retain the same card in the result.
 await page.evaluate(()=>{state.turn='B';state.ball=7;state.pendingCpuCard=null;renderAll();});
 const cpu=await page.evaluate(()=>state.pendingCpuCard.name);
 assert((await page.locator('#desktopBattleArena .away').innerText()).includes(cpu));
 await page.locator('#myCards .card').first().click();
 assert.equal(await page.evaluate(()=>state.pendingCpuCard.name),cpu);
 await page.locator('#desktopBattleArena .roll-duel').click();
 assert.equal(await page.evaluate(()=>state.battle.away.name),cpu);
 await page.waitForFunction(()=>state.duelPhase==='result');
 await page.locator('#desktopBattleArena .next-duel').click();
 // Reload DURING a shot animation: score and dice must survive exactly once.
 await page.evaluate(()=>{
   startMatch();state.ball=0;enterShotMode('A');state.homeCards[0].tiro=9;
   ['parada','reflejos','juego_aereo','uno_contra_uno'].forEach(k=>state.keeperB[k]=6);
   selectCard(state.homeCards[0].id);const old=d6,rolls=[6,1];d6=()=>rolls.shift();playTurn();d6=old;
 });
 assert.equal(await page.evaluate(()=>state.score.A),1);
 const goal=await page.evaluate(()=>JSON.stringify({battle:state.battle,score:state.score,time:state.time},(k,v)=>k==='photo_data'?undefined:v));
 await page.reload();await page.waitForFunction(()=>state.resultPending&&state.duelPhase==='result');
 assert.equal(await page.evaluate(()=>JSON.stringify({battle:state.battle,score:state.score,time:state.time},(k,v)=>k==='photo_data'?undefined:v)),goal);
 assert((await page.locator('#desktopBattleArena').innerText()).includes('¡GOOOL!'));
 assert.equal(await page.locator('#scoreA').innerText(),'1');
 await page.screenshot({path:path.join(__dirname,'outputs/mobile-goal-v6.png'),fullPage:true});
 // Restart during an animation cancels all callbacks; no old result can reappear.
 await page.evaluate(()=>{nextDuel();selectCard(availableHomeCards()[0].id);playTurn();startMatch();});
 await page.waitForTimeout(1700);
 assert.equal(await page.evaluate(()=>state.resultPending),false);
 assert.equal(await page.evaluate(()=>state.battle),null);
 // Reduced-motion users see the same result immediately, with no delayed input.
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const test of [{side:'A',goal:false},{side:'B',goal:true},{side:'B',goal:false}]){
   await page.evaluate(({side,goal})=>{
     startMatch();state.ball=side==='A'?0:12;enterShotMode(side);
     const keeper=side==='A'?state.keeperB:state.keeperA;
     ['parada','reflejos','juego_aereo','uno_contra_uno'].forEach(k=>keeper[k]=goal?1:10);
     if(side==='A')selectCard(state.homeCards[0].id);else prepareDuel();
     const old=d6;d6=()=>3;playTurn();d6=old;
   },test);
   assert.equal(await page.evaluate(()=>state.battle.goal),test.goal);
   assert.equal(await page.evaluate(()=>state.duelPhase),'result');
   assert.equal(await page.evaluate(()=>state.score.A+state.score.B),test.goal?1:0);
   assert((await page.locator('#desktopBattleArena').innerText()).includes(test.goal?'¡GOOOL!':test.side==='A'?'¡LO PARA EL RIVAL!':'¡PARADÓN!'));
 }
 // A tied shot is a keeper save, not a goal or a drawn normal duel.
 await page.evaluate(()=>{
   startMatch();state.ball=0;enterShotMode('A');state.homeCards[0].tiro=6;
   ['parada','reflejos','juego_aereo','uno_contra_uno'].forEach(k=>state.keeperB[k]=6);
   selectCard(state.homeCards[0].id);const old=d6;d6=()=>3;playTurn();d6=old;
 });
 assert.equal(await page.evaluate(()=>state.battle.goal),false);
 // Large winning margin is clipped at the shooting line; describe actual steps.
 await page.evaluate(()=>{
   startMatch();state.ball=1;state.homeCards[0].defensa=10;state.awayCards.forEach(c=>c.defensa=5);
   selectCard(state.homeCards[0].id);const old=d6,rolls=[6,1];d6=()=>rolls.shift();playTurn();d6=old;
 });
 assert.equal(await page.evaluate(()=>state.ball),0);
 assert((await page.locator('#desktopBattleArena').innerText()).includes('Avanzas 1 casilla'));
 assert((await page.locator('#desktopBattleArena').innerText()).includes('Límite: línea de tiro'));
 await page.evaluate(()=>{
   startMatch();state.homeCards[0][getCellStat(state.ball)]=7;state.awayCards.forEach(c=>c[getCellStat(state.ball)]=7);
   selectCard(state.homeCards[0].id);const old=d6;d6=()=>3;playTurn();d6=old;
 });
 assert((await page.locator('#desktopBattleArena').innerText()).includes('¡EMPATE!'));
 assert.equal(await page.evaluate(()=>state.ball),6);
 assert.equal(await page.evaluate(()=>state.turn),'B');
 // Complete a match, checking final-result presentation and deck replenishment.
 await page.evaluate(()=>{
   startMatch();let turns=0;
   while(!state.matchEnded&&turns++<100){
     if(!(state.shotMode&&state.shotAttacker==='B'))selectCard(availableHomeCards()[0].id);
     playTurn();if(!state.matchEnded)nextDuel();
   }
   if(!state.matchEnded)throw new Error('Match did not finish');
 });
 assert(await page.locator('#desktopBattleArena .next-duel').isEnabled());
 await page.locator('#desktopBattleArena .next-duel').click();
 assert((await page.locator('#desktopBattleArena').innerText()).includes('FINAL DEL PARTIDO'));
 // Legacy v5 completed matches remain readable without new animation metadata.
 await page.evaluate(()=>{delete state.battle.fromBall;delete state.battle.toBall;renderAll();});
 assert((await page.locator('#desktopBattleArena').innerText()).includes('FINAL DEL PARTIDO'));
 // Checkpoint hydration preserves photos even for identical player names across teams.
 await page.evaluate(async()=>{
   startMatch();const home=state.homeCards[0],away=state.awayCards[0];
   home.name=away.name='Mismo nombre';
   home.photo_data='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="blue"/></svg>';
   away.photo_data='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="pink"/></svg>';
   const stat=getCellStat(state.ball);home[stat]=9;away[stat]=9;selectCard(home.id);playTurn();await saveQueue;
   const old=await readValue('activeMatch');old.updatedAt=1;await storeValue('activeMatch',old);
   const recovered=await latestSavedMatch();
   if(recovered.state.homeCards[0].photo_data!==home.photo_data||recovered.state.awayCards[0].photo_data!==away.photo_data)
     throw new Error('Checkpoint mixed photos between teams');
 });
 for(const width of [320,360,412]){
   await page.setViewportSize({width,height:915});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const cell of await page.locator('.mini-cell .sub').all())assert(await cell.isVisible());
 }
 await page.setViewportSize({width:1440,height:1000});
 const duel=await page.locator('#desktopBattleArena').boundingBox(),pitch=await page.locator('#miniField').boundingBox();
 assert((await page.locator('[data-cell-key="12"]').boundingBox()).x<(await page.locator('[data-cell-key="0"]').boundingBox()).x,'desktop own goal left');
 assert(duel.y>pitch.y+pitch.height);
 await page.screenshot({path:path.join(__dirname,'outputs/desktop-result-v6.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: frozen portraits; real dice/sums; guarded input; step-by-step movement; result/goal reload; CPU order; goal/save/tie/clip cases; restart; reduced motion; full match; mobile/desktop layouts');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
