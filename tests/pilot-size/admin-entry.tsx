import { createRoot } from 'react-dom/client';
import { App } from '../../apps/admin-web/src/App';
import { AdminWebCoordinator, type AdminWebAuthPort } from '../../apps/admin-web/src/AdminWebCoordinator';
import { AdminWebApiClient } from '../../apps/admin-web/src/AdminWebApiClient';
import { fixtureFetch } from './fixture-fetch';

const auth:AdminWebAuthPort={ signIn:async()=> 'signed_in',signOut:async()=>{},
  withAccessToken:async operation=>operation('synthetic-local-only') };
const administration=new AdminWebCoordinator(auth,new AdminWebApiClient(fixtureFetch));
createRoot(document.getElementById('root')!).render(<App administration={administration}/>);
void administration.signIn('synthetic-pilot@example.invalid','synthetic-local-only');
