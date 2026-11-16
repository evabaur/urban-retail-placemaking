import assert from 'node:assert/strict';
import {canvasAppUrl} from '../lib/canvas-links.ts';
for(const path of ['/courses/900001/assignments/2000110','/courses/900001/modules/items/2000187','/courses/900001/files/2000198?module_item_id=2000187','/files/2000198'])assert.equal(canvasAppUrl('https://canvas.example.edu'+path),'canvas-courses://canvas.example.edu'+path);
for(const url of ['javascript:alert(1)','https://example.com/courses/1','https://canvas.example.edu.evil.test/courses/1','https://user:pass@canvas.example.edu/courses/1','http://canvas.example.edu/courses/1','https://canvas.example.edu/api/v1/courses/1'])assert.equal(canvasAppUrl(url),null);
console.log('PASS Canvas native target mapping and foreign-host/credential/non-content rejection');
