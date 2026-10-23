import path from 'node:path';

export const WORKSPACE = process.cwd();

export function safePath(p: string): string {
  const full = path.resolve(WORKSPACE, p);
  if (!full.startsWith(WORKSPACE)) {
    throw new Error('拒绝访问工作区以外的路径');
  }
  return full;
}