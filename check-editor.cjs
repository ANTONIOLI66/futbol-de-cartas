const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright');
const sample=`Name: José Luis Gayà Peña
Positions: SB,SM,WB
Registred Positions: ★SB
Age: 31
Speed: 79
Acceleration: 79
Balance: 77
Stamina: 80
Jump: 76
Defence: 78
Response: 81
Dribble Accuracy: 80
Dribble Speed: 78
Agility: 80
Technique: 81
Short Pass Accuracy: 81
Long Pass Accuracy: 80
Shot Accuracy: 71
Shot Power: 68
Shot Technique: 70
GK Skills: 50
SPECIAL ABILITIES:
★Marking
★Sliding`;
async function idb(page,key,value,write=false){return page.evaluate(async({key,value,write})=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('futbol-cartas',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});return new Promise((res,rej)=>{const tx=db.transaction('data',write?'readwrite':'readonly'),r=write?tx.objectStore('data').put(value,key):tx.objectStore('data').get(key);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();res(result)};tx.onerror=()=>rej(tx.error);});},{key,value,write});}
(async()=>{
 const {convertPES,validateDatabase,scale}=await import('./work/site/dist/pes-converter.mjs');
 const p=convertPES(sample);assert.deepEqual([p.ritmo,p.fisico,p.defensa,p.regate,p.pase,p.tiro],[7,7,7,7,7,5]);assert.deepEqual(p.pes6.special,['Marking','Sliding']);assert.equal(p.pes6.fields['registred positions'],'★SB');
 assert.throws(()=>convertPES(sample.replace('Speed: 79','Speed: 120')),/1 y 99/);assert.throws(()=>convertPES(sample.replace('Defence: 78','')),/Falta Defence/);assert.equal(scale(95),10);assert.equal(scale(40),1);assert.equal(scale(65),4);const gk=convertPES(sample,'keeper');assert(gk.parada>=1&&gk.parada<=10);
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/editor.html');await page.locator('#status').filter({hasText:'Base 2026–27'}).waitFor();
 const old={database_name:'Old reference',teams:[]},match={marker:'do not touch'};await idb(page,'database',old,true);await idb(page,'activeMatch',match,true);
 page.once('dialog',d=>d.accept('Valencia CF'));await page.locator('#addTeam').click();await page.locator('#teamName').waitFor();await page.locator('#addPlayer').click();await page.locator('#pesText').fill(sample);await page.locator('#convert').click();assert.equal(await page.locator('#personName').inputValue(),p.name);assert.equal(await page.locator('#stat-tiro').inputValue(),'5');
 await page.locator('#stat-tiro').fill('6');await page.reload();await page.locator('#personName').waitFor();assert.equal(await page.locator('#stat-tiro').inputValue(),'6');assert.match(await page.locator('#status').innerText(),/recuperado/);await page.locator('#savePerson').click();await page.locator('#personForm').waitFor({state:'hidden'});assert.equal((await idb(page,'editor2026_2027')).teams[0].players[0].tiro,6);assert.deepEqual(await idb(page,'database'),old);assert.deepEqual(await idb(page,'activeMatch'),match);
 await page.locator('#use').click();assert.match(await page.locator('#status').innerText(),/2 equipos/);
 await page.locator('#addKeeper').click();await page.locator('#pesText').fill(sample.replace(p.name,'Portero prueba').replace('GK Skills: 50','GK Skills: 90'));await page.locator('#convert').click();await page.locator('#savePerson').click();await page.locator('#personForm').waitFor({state:'hidden'});assert.equal((await idb(page,'editor2026_2027')).teams[0].keeper.name,'Portero prueba');
 const download=page.waitForEvent('download');await page.locator('#export').click();const d=await download;const exported=JSON.parse(fs.readFileSync(await d.path(),'utf8'));assert.equal(exported.season,'2026-2027');assert.equal(exported.teams[0].players[0].pes6.raw,sample);
 const full={...exported,teams:[0,1].map(i=>({...exported.teams[0],team_id:'full_'+i,team_name:['Valencia CF','Real Betis'][i],players:Array.from({length:10},(_,j)=>({...p,id:j+1,name:'Jugador '+(j+1)})),keeper:{...gk,name:'Portero '+i}}))};
 page.once('dialog',d=>d.accept());await page.locator('#jsonFile').setInputFiles({name:'26-27.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(full))});await page.waitForFunction(()=>document.querySelector('#teams').children.length===2);assert.deepEqual(await idb(page,'database'),old);
 page.once('dialog',d=>d.accept());await page.locator('#use').click();await page.locator('#status').filter({hasText:'activada'}).waitFor();assert.equal((await idb(page,'database')).teams.length,2);assert.deepEqual(await idb(page,'database_backup_before_2026_2027'),old);assert.deepEqual(await idb(page,'activeMatch'),match);
 await page.locator('#use').click({trial:true});page.once('dialog',d=>d.accept());await page.locator('#use').click();await page.waitForTimeout(100);assert.deepEqual(await idb(page,'database_backup_before_2026_2027'),old);
 await page.locator('#roster .player').first().click();await page.locator('#personName').fill('<img src=x onerror=alert(1)>');await page.locator('#savePerson').click();await page.locator('#status').filter({hasText:'sin etiquetas HTML'}).waitFor();assert.equal(await page.locator('#roster img').count(),0);await page.locator('#personName').fill('José Luis Gayà Peña');await page.locator('#savePerson').click();await page.locator('#personForm').waitFor({state:'hidden'});
 await page.locator('#roster .player').first().click();const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=100;c.getContext('2d').fillRect(0,0,80,100);return c.toDataURL('image/png').split(',')[1];});await page.locator('#photoFile').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('#photoPreview').waitFor({state:'visible'});await page.locator('#savePerson').click();await page.locator('#personForm').waitFor({state:'hidden'});assert.match((await idb(page,'editor2026_2027')).teams[0].players[0].photo_data,/^data:image\/jpeg/);
 await page.screenshot({path:path.join(__dirname,'outputs/editor-desktop.png'),fullPage:true});
 for(const width of [412,320]){await page.setViewportSize({width,height:915});await page.locator('#roster .player').first().click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);await page.screenshot({path:path.join(__dirname,`outputs/editor-mobile-${width}.png`),fullPage:true});await page.locator('#cancel').click();}
 await page.goto('http://127.0.0.1:4173/');assert.equal(await page.locator('a[href="editor.html"]').count(),1);assert((await page.locator('#homeSelect').innerText()).includes('Valencia CF'));
 assert.deepEqual(errors,[]);console.log('PASS conversion, validation, CRUD, reload recovery, JSON export/import, database isolation, backup, active-match preservation, photo upload, XSS, mobile/desktop layout, game integration');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
