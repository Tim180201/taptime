export const activity = { pending:0, count:0, lastActivity:0, responses:[] as {path:string;status:number;bytes:number}[] };
Object.assign(window,{pilotActivity:activity});
export const fixtureFetch:typeof fetch = async(input,init)=>{
  activity.pending++;activity.count++;activity.lastActivity=performance.now();
  try {
    // Priming gathers real response bytes before timed replay. SQL latency and
    // page walks must not let a browser abort discard a fixture. Timed pages
    // retain the application's normal AbortSignal and timeout behavior.
    const priming=(window as unknown as {pilotPriming?:boolean}).pilotPriming;
    const response=await fetch(input,priming?{...init,signal:undefined}:init);
    const bytes=(await response.clone().arrayBuffer()).byteLength;
    activity.responses.push({path:String(input),status:response.status,bytes});
    return response;
  } finally { activity.pending--;activity.lastActivity=performance.now(); }
};
