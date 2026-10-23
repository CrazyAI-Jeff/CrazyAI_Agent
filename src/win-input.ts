import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

const MOUSE_LIB = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
  public const uint LEFTDOWN = 0x0002;
  public const uint LEFTUP = 0x0004;
  public const uint RIGHTDOWN = 0x0008;
  public const uint RIGHTUP = 0x0010;
  public const uint MIDDLEDOWN = 0x0020;
  public const uint MIDDLEUP = 0x0040;
}
"@
`;

export async function runPowerShell(script: string): Promise<string> {
  const tmpFile = path.join(
    os.tmpdir(),
    `crazyai-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`
  );
  await fs.writeFile(tmpFile, script, 'utf8');
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { windowsHide: true, timeout: 15000 }
    );
    return stdout;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

export async function clickAt(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left'
) {
  const b = button.toUpperCase();
  const down = b === 'LEFT' ? 'LEFTDOWN' : b === 'RIGHT' ? 'RIGHTDOWN' : 'MIDDLEDOWN';
  const up = b === 'LEFT' ? 'LEFTUP' : b === 'RIGHT' ? 'RIGHTUP' : 'MIDDLEUP';

  await runPowerShell(`
${MOUSE_LIB}
[WinInput]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
Start-Sleep -Milliseconds 60
[WinInput]::mouse_event([WinInput]::${down}, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 40
[WinInput]::mouse_event([WinInput]::${up}, 0, 0, 0, [IntPtr]::Zero)
  `);
}

export async function moveTo(x: number, y: number) {
  await runPowerShell(`
${MOUSE_LIB}
[WinInput]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
  `);
}

export async function typeText(text: string) {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$bytes = [Convert]::FromBase64String('${b64}')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
[System.Windows.Forms.Clipboard]::SetText($text)
Start-Sleep -Milliseconds 120
[System.Windows.Forms.SendKeys]::SendWait('^v')
  `);
}

export async function pressKeys(keys: string) {
  if (!/^[a-z0-9+\- ]+$/i.test(keys)) {
    throw new Error('不合法的按键序列');
  }

  const map: Record<string, string> = {
    ctrl: '^', control: '^',
    alt: '%', shift: '+',
    enter: '{ENTER}', return: '{ENTER}',
    tab: '{TAB}', esc: '{ESC}', escape: '{ESC}',
    space: ' ',
    backspace: '{BACKSPACE}',
    delete: '{DELETE}', del: '{DELETE}',
    up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
    home: '{HOME}', end: '{END}',
    pageup: '{PGUP}', pagedown: '{PGDN}',
    f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}',
    f5: '{F5}', f6: '{F6}', f7: '{F7}', f8: '{F8}',
    f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}',
  };

  const parts = keys.toLowerCase().split('+').map(s => s.trim()).filter(Boolean);
  let mods = '';
  let key = '';

  for (const p of parts) {
    const mapped = map[p];
    if (mapped === '^' || mapped === '%' || mapped === '+') {
      mods += mapped;
    } else {
      key = mapped ?? p;
    }
  }

  const sequence = mods + key;
  await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${sequence}')
  `);
}