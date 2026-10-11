import path = require('node:path');
import { SituationRunPlanInput } from './situationRunPlan';
import { situationTestId } from './testingTree';
import { planXunitFactRun, XunitFactTarget } from './backendSituationRun';
import { planXunitTheoryRun, XunitTheoryTarget } from './xunitTheoryRun';

// Only route after an exact scoped definition match; never infer from name alone.
export function planXunitBackendRun(
  input:SituationRunPlanInput,
):XunitFactTarget|XunitTheoryTarget {
  const rows=input.joined.filter(row=>situationTestId(row)===input.situationId);
  if(rows.length!==1||!rows[0].backend)
    throw Error('Run Backend refused: unique Backend Situation not found');
  const row=rows[0],part=row.backend;
  const matching=input.definitions.filter(d=>
    d.adapterId==='xunit-v3'&&d.partRole==='backend'&&
    d.featureSpaceId===row.featureSpaceId&&d.logicalFolderKey===row.logicalFolderKey&&
    d.featureName===row.featureName&&d.outcome===row.outcome&&
    d.expectedBehavior===part!.expectedBehavior&&
    path.resolve(d.source.file).toLowerCase()===path.resolve(part!.source.file).toLowerCase()&&
    d.source.line===part!.source.line);
  if(matching.length!==1) throw Error('Run Backend refused: ambiguous Backend source');
  return matching[0].isParameterized
    ? planXunitTheoryRun(input) : planXunitFactRun(input);
}
