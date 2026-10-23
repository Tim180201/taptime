const sameCatalog=(actual,planned)=>Array.isArray(planned)&&planned.length>0&&new Set(actual).size===actual.length
  &&actual.length===planned.length&&[...actual].sort().every((value,index)=>value===[...planned].sort()[index]);

export function assertMeasurement(item,browserCompletion=item.completion,hasBrowserReplacement=false) {
  const profile=item.profile;
  const completed=item.completion;
  if(!['full','backend-verified'].includes(completed.mode)||completed.mode==='backend-verified'&&!hasBrowserReplacement
    ||completed.profile!==profile||completed.reference!==item.dataset.reference||completed.smoke)throw Error(`Missing completed measurement ${profile}`);
  if(!sameCatalog(item.reads.map(row=>`${row.role}/${row.name}`),completed.readCases)
    ||!sameCatalog(item.exports.map(row=>`${row.month}/v${row.version}`),completed.exportCases)
    ||!sameCatalog(item.browser.map(row=>row.name),browserCompletion.browserScenarios))throw Error(`Incomplete measurement catalog ${profile}`);
  const minimumBurstMs=completed.burstWindowMilliseconds*(completed.activePeople-1)/completed.activePeople;
  const headerSpan=Date.parse(item.load.starts.at(-1)?.headers.date)-Date.parse(item.load.starts[0]?.headers.date);
  if(item.load.smoke||item.load.starts.length!==completed.activePeople||item.load.offline.length!==completed.offlineRequests
    ||!Number.isFinite(minimumBurstMs)||!Number.isFinite(item.load.elapsedSeconds)||item.load.elapsedSeconds*1000<minimumBurstMs
    ||item.load.elapsedSeconds*1000>completed.burstWindowMilliseconds
    ||!Number.isFinite(headerSpan)||headerSpan<Math.floor(minimumBurstMs/1000)*1000
    ||headerSpan>completed.burstWindowMilliseconds)throw Error(`Incomplete/compressed/interrupted write load ${profile}`);
  if(item.dataset.smoke||!item.resources.cleaned)throw Error(`Incomplete profile ${profile}`);
  if(item.reads.some(row=>row.samples.length!==20)||item.exports.some(row=>row.samples.length!==20)||item.browser.some(row=>row.samples.length!==20))throw Error(`Missing repetitions ${profile}`);
  if(item.browser.some(row=>row.samples.some(sample=>sample.failed||sample.errors.length)))throw Error(`Invalid browser fixture ${profile}`);
}
