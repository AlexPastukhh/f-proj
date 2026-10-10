import { Diagnostic } from './types';

function combined(error?: string, stderr?: string, stdout?: string): string {
  return [error, stderr, stdout].filter(Boolean).join('\n');
}

export function classifyNodePrerequisiteFailure(error?: string, stderr?: string, stdout?: string): Diagnostic | undefined {
  const text = combined(error, stderr, stdout);
  if (!text) return undefined;
  const missingExecutable = /\bENOENT\b|not recognized as an internal or external command|command not found|cannot find (?:the )?(?:file|path)/i.test(text);
  if (!missingExecutable) return undefined;
  return {
    ruleId:'worker/node-runtime-missing',
    category:'runtime',
    severity:'error',
    projectionImpact:'blocks-part',
    message:'Vitest materialization requires an external Node.js runtime. Install Node.js and ensure node is on PATH, or set featureProjection.nodePath to a valid Node executable.',
  };
}

export function classifyDotnetPrerequisiteFailure(error?: string, stderr?: string, stdout?: string): Diagnostic | undefined {
  const text = combined(error, stderr, stdout);
  if (!text) return undefined;
  const missingExecutable = /spawn\s+dotnet(?:\.exe)?\s+ENOENT|\bdotnet(?:\.exe)?\b.*\bENOENT\b|not recognized as an internal or external command|dotnet:\s*command not found/i.test(text);
  const incompatibleRuntime = /you must install or update \.net|the framework ['"].+['"] was not found|compatible framework version|no \.net sdks were found|a fatal error was encountered.*hostpolicy|sdk ['"]Microsoft\.NET\.Sdk['"].*could not be found/i.test(text);
  if (!missingExecutable && !incompatibleRuntime) return undefined;
  return {
    ruleId:'worker/dotnet-prerequisite-unavailable',
    category:'runtime',
    severity:'error',
    projectionImpact:'blocks-part',
    message:'xUnit project analysis/materialization requires a compatible .NET SDK/runtime. Install a compatible .NET SDK/runtime and ensure dotnet is available on PATH for the configured project.',
  };
}
