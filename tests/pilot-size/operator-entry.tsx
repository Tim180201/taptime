import { createRoot } from 'react-dom/client';
import { App } from '../../apps/operator-web/src/App';
import { OperatorRuntime, type OperatorAuth } from '../../apps/operator-web/src/OperatorRuntime';
import { fixtureFetch } from './fixture-fetch';

const auth:OperatorAuth={getAccessToken:async()=> 'synthetic-local-only',signIn:async()=>{},signOut:async()=>{},
  onSignedOut:()=>()=>{},prepareMfa:async()=>({factorId:'synthetic'}),verifyMfa:async()=>{}};
sessionStorage.setItem('taptime-operator-last-activity',String(Date.now()));
createRoot(document.getElementById('root')!).render(<App runtime={new OperatorRuntime(auth,sessionStorage,fixtureFetch)}/>);
