import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function isMainModule(moduleUrl: string, argvEntry = process.argv[1]): boolean {
  return typeof argvEntry === 'string' && moduleUrl === entryPathToFileUrl(argvEntry);
}

export function portablePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function entryPathToFileUrl(entryPath: string): string {
  if (/^[A-Za-z]:[\\/]/.test(entryPath)) {
    return new URL(`file:///${portablePath(entryPath)}`).href;
  }

  return pathToFileURL(resolve(entryPath)).href;
}
