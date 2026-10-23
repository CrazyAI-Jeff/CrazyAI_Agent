import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Skill } from './types.js';

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

export async function loadSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];

  let entries: string[] = [];
  try {
    entries = await fs.readdir(SKILLS_DIR);
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.ts') && !entry.endsWith('.js')) continue;

    const full = path.join(SKILLS_DIR, entry);
    try {
      const mod = await import(`${pathToFileURL(full).href}?t=${Date.now()}`);
      const skill = mod.default as Skill;

      if (!skill?.name || typeof skill.execute !== 'function') {
        console.warn(`跳过无效技能: ${entry}`);
        continue;
      }
      skills.push(skill);
    } catch (e: any) {
      console.warn(`加载技能失败 ${entry}: ${e.message}`);
    }
  }

  return skills;
}