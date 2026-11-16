import type {VpaDraft} from './vpa';
// A preview/navigation action must not create a new revision when content is unchanged.
export function vpaContentKey(d:VpaDraft){
 return JSON.stringify([d.includeNotes,Object.entries(d.answers).sort(([a],[b])=>a.localeCompare(b)),d.photos,d.ppt,d.video,d.importedFrom||null]);
}
