import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { after, before, test } from 'node:test';
import { parse } from 'yaml';
const id=`t068b-caddy-${process.pid}`;
const root=mkdtempSync(join(tmpdir(),'t068b-caddy-'));
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let port;
function request(host,path){return new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port,path,headers:{Host:host,'X-Forwarded-Host':'api.tb-infra.de','X-TapTime-Proxy-Secret':'forged'}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end();});}
before(async()=>{
  const production=readFileSync(process.env.TAPTIME_TEST_CADDY_SOURCE??'infrastructure/caddy/Caddyfile','utf8');
  // Test the production routes verbatim; only transport/listen port changes for local HTTP.
  const config='{\n auto_https off\n}\n'+production.replace(/^(api|admin|betreiber)\.tb-infra\.de \{/gm,'http://$1.tb-infra.de:8080 {');
  writeFileSync(join(root,'Caddyfile'),config);
  writeFileSync(join(root,'secret'),'synthetic-proxy-proof');
  for(const web of ['admin-web','operator-web']){
    mkdirSync(join(root,web,'current'),{recursive:true});mkdirSync(join(root,web,'releases','abcdef0','assets'),{recursive:true});
    writeFileSync(join(root,web,'current','index.html'),`<!doctype html><title>${web}</title>`);
    writeFileSync(join(root,web,'current','version.txt'),'abcdef0');
    writeFileSync(join(root,web,'releases','abcdef0','index.html'),'<!doctype html><title>versioned</title>');
    writeFileSync(join(root,web,'releases','abcdef0','assets','app.js'),'synthetic-bundle');
  }
  docker('network','create',id);
  docker('run','-d','--name',`${id}-backend`,'--network',id,'--network-alias','backend-api','node:24.17.0-alpine','node','-e',"require('node:http').createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({headers:req.headers,path:req.url}));}).listen(3000)");
  docker('create','--name',id,'--network',id,'-p','127.0.0.1:0:8080','caddy:2.10.2-alpine','caddy','run','--config','/tmp/Caddyfile','--adapter','caddyfile');
  docker('cp',join(root,'Caddyfile'),`${id}:/tmp/Caddyfile`);
  // docker cp requires the destination parent, so use existing /srv for web data.
  docker('cp',join(root,'admin-web'),`${id}:/srv/admin-web`);docker('cp',join(root,'operator-web'),`${id}:/srv/operator-web`);
  docker('start',id);docker('exec',id,'mkdir','-p','/run/secrets');docker('cp',join(root,'secret'),`${id}:/run/secrets/taptime_proxy_shared_secret`);
  port=docker('inspect','--format','{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}',id);
  for(let attempt=0;attempt<30;attempt++){try{await request('admin.tb-infra.de','/');return;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  throw new Error('Local Caddy did not start');
});
after(()=>{for(const name of [id,`${id}-backend`]){try{docker('rm','-f',name);}catch{}}try{docker('network','rm',id);}catch{}rmSync(root,{recursive:true,force:true});});
for(const host of ['api.tb-infra.de','admin.tb-infra.de'])test(`${host} explicitly rejects operator routes`,async()=>{
  for(const path of ['/v1/operator/session','/v1/operator/organizations/create'])assert.equal((await request(host,path)).status,404);
});
test('operator host proxies only operator routes with trusted forwarding',async()=>{
  const res=await request('betreiber.tb-infra.de','/v1/operator/session');assert.equal(res.status,200);
  const body=await res.json();assert.equal(body.path,'/v1/operator/session');assert.equal(body.headers['x-forwarded-host'],'betreiber.tb-infra.de');assert.equal(body.headers['x-taptime-proxy-secret'],'synthetic-proxy-proof');
  for(const path of ['/v1/session','/v2/session','/v3/time-entries/export','/v4/lifecycle-events/offline','/health'])assert.equal((await request('betreiber.tb-infra.de',path)).status,404,path);
});
test('operator static paths serve version, SPA and assets with strict headers',async()=>{
  for(const path of ['/','/protokoll','/index.html','/releases/abcdef0/index.html']){
    const res=await request('betreiber.tb-infra.de',path);assert.equal(res.status,200,path);assert.equal(res.headers.get('cache-control'),'no-store',path);
    for(const [header,value] of [['x-frame-options','DENY'],['strict-transport-security','max-age=31536000; includeSubDomains']])assert.equal(res.headers.get(header),value);
    const csp=res.headers.get('content-security-policy');assert.ok(csp);assert.match(csp,/script-src 'self'/);assert.match(csp,/connect-src 'self' https:\/\/\*\.supabase.co/);assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);
  }
  const version=await request('betreiber.tb-infra.de','/version.txt');assert.equal(await version.text(),'abcdef0');assert.equal(version.headers.get('cache-control'),'no-store');
  const asset=await request('betreiber.tb-infra.de','/releases/abcdef0/assets/app.js');assert.equal(await asset.text(),'synthetic-bundle');assert.match(asset.headers.get('cache-control'),/immutable/);
  assert.equal((await request('betreiber.tb-infra.de','/releases/abcdef0/assets/missing.js')).status,404);
});
test('server Compose mounts operator web read-only',()=>{
  const compose=parse(readFileSync('infrastructure/docker-compose.server.yml','utf8'));
  assert.ok(compose.services.caddy.volumes.includes('/opt/taptime/operator-web:/srv/operator-web:ro'));
});
test('disabled operator web has no SPA, release assets or operator API',async()=>{
  docker('exec',id,'rm','-r','/srv/operator-web/current');
  for(const path of ['/','/version.txt','/protokoll','/releases/abcdef0/assets/app.js','/v1/operator/session'])assert.equal((await request('betreiber.tb-infra.de',path)).status,404,path);
});
