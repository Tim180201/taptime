import {expect,it} from 'vitest';
import {formatHours,formatDuration} from '../../src/index.js';
it.each([[0,'0:00'],[59*60000+59999,'0:59'],[24*3600000,'24:00'],[101*3600000+7*60000,'101:07']])('formats duration %s without decimal rounding', (ms,label)=>{
 expect(formatHours(Number(ms))).toBe(label); expect(formatDuration(Number(ms))).toBe(`${label} h`);
});
