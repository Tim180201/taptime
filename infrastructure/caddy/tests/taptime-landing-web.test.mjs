import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { request as httpRequest } from 'node:http';
import { after, before, test } from 'node:test';
const id=`t031-landing-${process.pid}`;
const root=mkdtempSync(join(process.cwd(),'.t031-local-'));
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const oldPassword='testpass11111111', newPassword='testpass22222222';
let port, oldHash;
function request(path, password, host='tb-infra.de') { return new Promise((resolve,reject)=>{
  const headers={Host:host}; if(password) headers.Authorization='Basic '+Buffer.from('pilot:'+password).toString('base64');
  const req=httpRequest({hostname:'127.0.0.1',port,path,headers,agent:false},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end();
}); }
function tool(mode='', input=newPassword+'\n'+newPassword+'\n', args=[]) {
  return spawnSync('docker',['run','--rm','-i','--network',id,'--volume',`${id}-auth:/opt/taptime/landing-auth`,'--volume',`${id}-trace:/trace`,
    '--volume','/var/run/docker.sock:/var/run/docker.sock','--volume',`${root}/fault:/fault:ro`,'--volume',`${resolve('infrastructure/operations/taptime-landing-password')}:/tool:ro`,
    '--env',`TAPTIME_LANDING_PROJECT=${id}`,'--env','TAPTIME_LANDING_ORIGIN=http://tb-infra.de:8080','--env',`FAULT=${mode}`,
    '--env','PATH=/fault:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','--entrypoint','bash','taptime-t031-tools:local','/tool',...args],{input,encoding:'utf8'});
}
const authFile=()=>docker('exec',id,'cat','/srv/landing-auth/password.hash');
const resetTrace=()=>docker('run','--rm','--volume',`${id}-trace:/trace`,'--entrypoint','sh','taptime-t031-tools:local','-c','rm -f /trace/*');
before(async()=>{
  let production=readFileSync('infrastructure/caddy/Caddyfile','utf8');
  production=production.replace(/^(api|admin|betreiber)\.tb-infra\.de \{/gm,'http://$1.tb-infra.de:8080 {')
    .replace(/^tb-infra\.de \{/gm,'http://tb-infra.de:8080 {')
    .replace(/^www\.tb-infra\.de, http:\/\/www\.tb-infra\.de \{/gm,'http://www.tb-infra.de:8080 {');
  writeFileSync(join(root,'Caddyfile'),'{\n auto_https off\n}\n'+production);
  mkdirSync(join(root,'landing-web/releases/abcdef0/assets'),{recursive:true});
  mkdirSync(join(root,'landing-web/releases/abcdef0/tag-assets/fonts'),{recursive:true});
  for(const [file,body] of Object.entries({'index.html':'<!doctype html><title>private</title>','tag.html':'<!doctype html><title>tag</title>','robots.txt':'User-agent: *\nDisallow: /','version.txt':'abcdef0','assets/private.js':'private','tag-assets/tag.css':'body {}','tag-assets/fonts.css':'/* local */','tag-assets/fonts/manrope-400.ttf':'synthetic-font'})) writeFileSync(join(root,'landing-web/releases/abcdef0',file),body);
  mkdirSync(join(root,'fault'));
  writeFileSync(join(root,'fault/docker'),`#!/bin/sh
printf '%s\\n' "$*" >> /trace/argv
case " $* " in
  *" caddy reload "*)
    if [ "$FAULT" = reload ] && [ ! -f /trace/failed ]; then
      touch /trace/failed
      /usr/bin/docker "$@" >/dev/null 2>&1
      exit 77
    fi;;
esac
exec /usr/bin/docker "$@"
`);
  writeFileSync(join(root,'fault/curl'),`#!/bin/sh
if [ "$FAULT" = check ] && [ ! -f /trace/failed ]; then touch /trace/failed; exit 28; fi
exec /usr/bin/curl "$@"
`);
  chmodSync(join(root,'fault/docker'),0o755);chmodSync(join(root,'fault/curl'),0o755);
  docker('network','create',id);docker('volume','create',`${id}-auth`);docker('volume','create',`${id}-trace`);
  oldHash=execFileSync('docker',['run','--rm','-i','--entrypoint','caddy','taptime-t031-tools:local','hash-password'],{input:oldPassword+'\n',encoding:'utf8'}).trim();
  execFileSync('docker',['run','--rm','-i','--volume',`${id}-auth:/auth`,'--entrypoint','sh','taptime-t031-tools:local','-c','chmod 700 /auth; umask 077; cat > /auth/password.hash'],{input:oldHash+'\n'});
  docker('run','-d','--name',id,'--label',`com.docker.compose.project=${id}`,'--label','com.docker.compose.service=caddy','--network',id,'--network-alias','tb-infra.de','-p','127.0.0.1:0:8080',
    '--volume',`${root}/Caddyfile:/etc/caddy/Caddyfile:ro`,'--volume',`${root}/landing-web:/srv/landing-web`,'--volume',`${id}-auth:/srv/landing-auth:ro`,'caddy:2.10.2-alpine');
  docker('exec',id,'ln','-s','releases/abcdef0','/srv/landing-web/current');
  port=docker('inspect','--format','{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}',id);
  for(let attempt=0;attempt<30;attempt++){try {if((await request('/')).status===401)return;} catch{} await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error('Local landing Caddy did not start');
});
after(()=>{try{docker('rm','-f',id);}catch{}for(const resource of ['auth','trace'])try{docker('volume','rm',`${id}-${resource}`);}catch{}try{docker('network','rm',id);}catch{}rmSync(root,{recursive:true,force:true});});
test('private homepage and release assets require auth; only tag resources, robots and version are public',async()=>{
  for(const path of ['/','/index.html','/tag.html','/releases/abcdef0/index.html','/releases/abcdef0/assets/private.js']){
    assert.equal((await request(path)).status,401,path);assert.equal((await request(path,oldPassword)).status,200,path);
  }
  for(const path of ['/tag','/robots.txt','/version.txt','/releases/abcdef0/tag-assets/tag.css','/releases/abcdef0/tag-assets/fonts.css','/releases/abcdef0/tag-assets/fonts/manrope-400.ttf'])assert.equal((await request(path)).status,200,path);
  for(const path of ['/v1/session','/health'])assert.equal((await request(path,oldPassword)).status,404,path);
});
test('strict CSP and noindex include authentication failures, public responses and redirects',async()=>{
  for(const path of ['/','/tag','/robots.txt','/version.txt','/health']){
    const response=await request(path);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
    assert.equal(response.headers.get('x-frame-options'),'DENY');const csp=response.headers.get('content-security-policy');assert.match(csp,/connect-src 'none'/);assert.doesNotMatch(csp,/https:|unsafe-|data:/);
  }
  const redirected=await request('/tag?x=1',null,'www.tb-infra.de');assert.equal(redirected.status,301);assert.equal(redirected.headers.get('location'),'https://tb-infra.de/tag?x=1');
});
for(const mode of ['reload','check'])test(`${mode} failure restores the old hash AND the provisioned login`,async()=>{
  resetTrace();const result=tool(mode);assert.notEqual(result.status,0);assert.equal(authFile(),oldHash);
  assert.equal((await request('/',oldPassword)).status,200);assert.equal((await request('/',newPassword)).status,401);
  const trace=docker('run','--rm','--volume',`${id}-trace:/trace`,'--entrypoint','cat','taptime-t031-tools:local','/trace/argv');
  assert.equal(trace.split('\n').filter(line=>line.includes('caddy reload --config - --force')).length,2);
  for(const output of [trace,result.stdout,result.stderr]){assert.ok(!output.includes(newPassword));assert.ok(!output.includes(oldHash));}
});
test('stdin password set and disable are atomic, force-provisioned, and quiet',async()=>{
  resetTrace();let result=tool();assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'gesetzt\n');assert.equal(result.stderr,'');
  assert.equal((await request('/',newPassword)).status,200);assert.equal((await request('/',oldPassword)).status,401);
  result=tool('', '', ['--disable']);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'gesperrt\n');assert.equal((await request('/',newPassword)).status,401);assert.equal((await request('/tag')).status,200);
});
test('no active landing closes every path, including retained releases',async()=>{
  docker('exec',id,'rm','/srv/landing-web/current');
  for(const path of ['/','/tag','/version.txt','/releases/abcdef0/tag-assets/tag.css'])assert.equal((await request(path)).status,404);
});
test('missing hash prevents provisioning even when the landing is disabled',()=>{
  docker('run','--rm','--volume',`${id}-auth:/auth`,'--entrypoint','rm','taptime-t031-tools:local','/auth/password.hash');
  const result=spawnSync('docker',['exec',id,'caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/file|hash/);
});
