export interface SkillResultObject {
  text: string;
  images?: string[];
}

export interface Skill {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<string | SkillResultObject>;
  filename?: string;
}