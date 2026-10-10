declare module 'node:fs' { const x: any; export = x; }
declare module 'node:path' { const x: any; export = x; }
declare module 'node:child_process' { export const spawn: any; }
declare module 'node:url' { export const pathToFileURL: any; }
declare var process: any;
declare var __dirname: string;
declare module 'node:assert/strict' { const x: any; export = x; }
declare module '@vscode/test-electron' { export const runTests: any; }
