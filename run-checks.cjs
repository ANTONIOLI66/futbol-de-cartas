// Ejecuta todas las pruebas QA en orden. Si no hay servidor en 127.0.0.1:4173, arranca editor-preview.cjs.
const {spawn,spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const CHECKS=['check-role-balance','check-tactical','check-ai','check-hand','check-game','check-duel-result','check-editor'];
const up=()=>new Promise(r=>http.get('http://127.0.0.1:4173/',res=>{res.resume();r(true);}).on('error',()=>r(false)));
(async()=>{
  fs.mkdirSync(path.join(__dirname,'outputs'),{recursive:true});
  let server=null;
  if(!await up()){
    server=spawn(process.execPath,[path.join(__dirname,'editor-preview.cjs')],{stdio:'ignore'});
    for(let i=0;i<50&&!await up();i++)await new Promise(r=>setTimeout(r,100));
    if(!await up()){console.error('No se pudo arrancar el servidor en 127.0.0.1:4173');server.kill();process.exit(1);}
  }
  const failed=[];
  for(const name of CHECKS){
    console.log('\n=== '+name);
    const r=spawnSync(process.execPath,[path.join(__dirname,name+'.cjs')],{stdio:'inherit',cwd:__dirname});
    if(r.status!==0)failed.push(name);
  }
  if(server)server.kill();
  console.log(failed.length?'\nFALLAN: '+failed.join(', '):'\nTodas las pruebas pasan ('+CHECKS.length+').');
  process.exit(failed.length?1:0);
})();
