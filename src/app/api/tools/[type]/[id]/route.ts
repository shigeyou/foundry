import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { FinderConfig, DrafterConfig, SimulatorConfig } from '@foundry/core/types';
import { FinderEngine, DrafterEngine, SimulatorEngine } from '@foundry/core/engines';

type ToolConfig = FinderConfig | DrafterConfig | SimulatorConfig;
type ToolType = 'finders' | 'drafters' | 'simulators';

interface RouteParams {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

function getToolTypePlural(type: string): ToolType | null {
  const mapping: Record<string, ToolType> = {
    finder: 'finders',
    drafter: 'drafters',
    simulator: 'simulators',
  };
  return mapping[type] || null;
}

function loadConfig(type: ToolType, id: string): ToolConfig | null {
  const configPath = path.join(process.cwd(), 'src', 'configs', type, `${id}.json`);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as ToolConfig;
}

// GET: ツール設定を取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { type, id } = await params;
    const toolType = getToolTypePlural(type);

    if (!toolType) {
      return NextResponse.json(
        { error: `Invalid tool type: ${type}` },
        { status: 400 }
      );
    }

    const config = loadConfig(toolType, id);

    if (!config) {
      return NextResponse.json(
        { error: `Tool not found: ${type}/${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      type,
      config,
    });
  } catch (error) {
    console.error('Failed to load tool config:', error);
    return NextResponse.json(
      { error: 'Failed to load tool configuration' },
      { status: 500 }
    );
  }
}

// POST: ツールを実行
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { type, id } = await params;
    const toolType = getToolTypePlural(type);

    if (!toolType) {
      return NextResponse.json(
        { error: `Invalid tool type: ${type}` },
        { status: 400 }
      );
    }

    const config = loadConfig(toolType, id);

    if (!config) {
      return NextResponse.json(
        { error: `Tool not found: ${type}/${id}` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { input, ragContext, additionalContext } = body;

    // LLMオプション（環境変数から自動初期化されるため、オプションのみ指定）
    const llmOptions = {
      temperature: 0.7,
      maxTokens: 16000,
      jsonMode: true,
    };

    let result;

    switch (type) {
      case 'finder': {
        const engine = new FinderEngine(config as FinderConfig, llmOptions);
        result = await engine.run({
          userInput: input || {},
          ragContext,
          additionalContext,
        });
        break;
      }
      case 'drafter': {
        const engine = new DrafterEngine(config as DrafterConfig, llmOptions);
        result = await engine.run({
          userInput: input || {},
          ragContext,
          additionalContext,
        });
        break;
      }
      case 'simulator': {
        const engine = new SimulatorEngine(config as SimulatorConfig, llmOptions);
        result = await engine.run({
          userInput: input || {},
          ragContext,
          additionalContext,
        });
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unsupported tool type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to execute tool:', error);
    return NextResponse.json(
      { error: 'Failed to execute tool', details: String(error) },
      { status: 500 }
    );
  }
}
