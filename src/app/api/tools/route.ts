import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { FinderConfig, DrafterConfig, SimulatorConfig } from '@foundry/core/types';

type ToolType = 'finders' | 'drafters' | 'simulators';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
function loadConfigs<T>(type: ToolType): T[] {
  const configDir = path.join(process.cwd(), 'src', 'configs', type);

  if (!fs.existsSync(configDir)) {
    return [];
  }

  const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));

  const configs = files.map(file => {
    const content = fs.readFileSync(path.join(configDir, file), 'utf-8');
    return JSON.parse(content) as T;
  });

  // Sort by order property (ascending), items without order go last
  return configs.sort((a, b) => ((a as any).order ?? 999) - ((b as any).order ?? 999));
}

export async function GET() {
  try {
    const finders = loadConfigs<FinderConfig>('finders');
    const drafters = loadConfigs<DrafterConfig>('drafters');
    const simulators = loadConfigs<SimulatorConfig>('simulators');

    return NextResponse.json({
      finders,
      drafters,
      simulators,
      total: finders.length + drafters.length + simulators.length,
    });
  } catch (error) {
    console.error('Failed to load tool configs:', error);
    return NextResponse.json(
      { error: 'Failed to load tool configurations' },
      { status: 500 }
    );
  }
}
