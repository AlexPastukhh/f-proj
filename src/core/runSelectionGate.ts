/** Verify the VS Code TestItem object, not just its reusable ID string.
 * Prevents an old Test Explorer item from launching a newly published case.
 */
export interface PublishedItem {
  id:string;
  children:{get(id:string):unknown};
}
export type RunSelectionRole='frontend'|'backend'|'both';

export function isPublishedRunSelection(
  selected:{id:string}|undefined,role:RunSelectionRole,
  published:ReadonlyMap<string,PublishedItem>,
):boolean {
  if(!selected||typeof selected.id!=='string')return false;
  if(role==='both') return published.get(selected.id)===selected;
  const suffix='/'+role;
  if(!selected.id.endsWith(suffix))return false;
  const parentId=selected.id.slice(0,-suffix.length);
  const parent=published.get(parentId);
  return !!parent&&parent.children.get(selected.id)===selected;
}
