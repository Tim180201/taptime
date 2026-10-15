import {afterEach,expect,it,vi} from 'vitest';
import config from '../../vite.config';
afterEach(()=>vi.unstubAllEnvs());
it('proxies every client search API version to the local development backend',()=>{
 vi.stubEnv('TAPTIME_API_PROXY_TARGET','http://localhost:3000');
 const resolved=typeof config==='function'?config({command:'serve',mode:'development'}):config;
 expect(resolved).toMatchObject({server:{proxy:{
  '/v1':{target:'http://localhost:3000'},
  '/v2':{target:'http://localhost:3000'},
  '/v3':{target:'http://localhost:3000'},
  '/v4':{target:'http://localhost:3000'},
 }}});
});
