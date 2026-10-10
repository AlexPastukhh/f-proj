import fs = require('node:fs');
import path = require('node:path');
import { PrototypeConfig } from './types';

export function readPrototypeConfig(configPath: string): PrototypeConfig {
  return JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8')) as PrototypeConfig;
}
