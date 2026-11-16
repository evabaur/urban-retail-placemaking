import assert from 'node:assert/strict';
import {vpaContentKey} from '../lib/vpa-draft-state.ts';
const d={revision:1,includeNotes:true,answers:{b:'two',a:'one'},photos:[],ppt:'file1',video:null};
assert.equal(vpaContentKey(d),vpaContentKey({...d,revision:99,answers:{a:'one',b:'two'}}));
for(const update of [{includeNotes:false},{answers:{a:'changed'}},{photos:['photo']},{ppt:'file2'},{video:'video'},{importedFrom:'Trek 1'}])assert.notEqual(vpaContentKey(d),vpaContentKey({...d,...update}));
console.log('PASS unchanged-content/revision/key-order stability and all VPA input change detection');
