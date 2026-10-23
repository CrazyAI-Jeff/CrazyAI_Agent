import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { runAgent, initSkills } from './agent.js';

await initSkills();

const rl = readline.createInterface({ input, output });
console.log('智能体已启动。输入 exit 退出。\n');

while (true) {
  const text = (await rl.question('你: ')).trim();
  if (!text) continue;
  if (text === 'exit' || text === 'quit') break;

  try {
    const { reply, trace } = await runAgent(text);
    for (const t of trace) {
      console.log(`  [技能] ${t.tool}(${JSON.stringify(t.args)})`);
    }
    console.log(`AI: ${reply}\n`);
  } catch (err) {
    console.error('出错:', err);
  }
}

rl.close();