/** Android keeps its existing link. On iOS only the installed variant's scheme is accepted. */
export function isLockScreenCaptureLink(url:string|null,platform:string,scheme:string|string[]|undefined):boolean {
  if(platform!=='ios')return url==='taptime://lock-screen/capture';
  const schemes=typeof scheme==='string'?[scheme]:scheme??[];
  return schemes.some(value=>url===`${value}://lock-screen/capture`);
}
