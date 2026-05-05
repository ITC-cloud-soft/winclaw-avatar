#!/usr/bin/env node
/**
 * Qwen3.5-Omni Realtime テスト
 *
 * テスト内容:
 *   1. モデル接続テスト（WebSocket）
 *   2. Realtime Function Calling テスト（session.update に tools を送信）
 *   3. HTTP API Function Calling テスト（qwen3-omni-flash / qwen3.5-omni-flash）
 *
 * Usage:
 *   node tests/test-qwen35-realtime.mjs
 */

import { readFileSync } from 'fs';
import { WebSocket } from 'ws';
import https from 'https';

// ─── Config ──────────────────────────────────────────────────────
const config = JSON.parse(readFileSync('C:/Users/USER/.winclaw/winclaw.json', 'utf-8'));
const API_KEY = config.plugins.entries['digital-human'].config.qwen.apiKey;

const REALTIME_MODELS = [
  'qwen3-omni-flash-realtime',
  'qwen3.5-omni-flash-realtime',
  'qwen3.5-omni-plus-realtime',
];

const HTTP_MODELS = [
  'qwen3-omni-flash',
  'qwen3.5-omni-flash',
  'qwen3.5-omni-plus',
];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名' },
        },
        required: ['city'],
      },
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────
function log(tag, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [${tag}] ${msg}`);
}

function separator(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(70)}\n`);
}

// ─── Test 1: Realtime WebSocket 接続テスト ────────────────────────
async function testRealtimeConnection(model) {
  return new Promise((resolve) => {
    const url = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`;
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    const timeout = setTimeout(() => {
      ws.close();
      log(model, '❌ タイムアウト (10s)');
      resolve({ model, status: 'TIMEOUT' });
    }, 10000);

    ws.on('open', () => {
      log(model, '✅ WebSocket 接続成功');
      // session.update を送信
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          voice: 'Tina',
          instructions: 'テスト',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: { type: 'server_vad' },
        },
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'session.created') {
          log(model, `✅ session.created — モデル使用可能`);
          clearTimeout(timeout);
          ws.close();
          resolve({ model, status: 'OK', session: msg });
        } else if (msg.type === 'session.updated') {
          log(model, `✅ session.updated`);
        } else if (msg.type === 'error') {
          log(model, `❌ エラー: ${msg.error?.message || JSON.stringify(msg)}`);
          clearTimeout(timeout);
          ws.close();
          resolve({ model, status: 'ERROR', error: msg.error });
        } else {
          log(model, `  受信: ${msg.type}`);
        }
      } catch (e) {
        // binary frame, ignore
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      log(model, `❌ 接続エラー: ${err.message}`);
      resolve({ model, status: 'CONNECT_ERROR', error: err.message });
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (code !== 1000 && code !== 1005) {
        log(model, `  切断: code=${code} reason=${reason?.toString()}`);
      }
    });
  });
}

// ─── Test 2: Realtime Function Calling テスト ────────────────────
async function testRealtimeFunctionCalling(model) {
  return new Promise((resolve) => {
    const url = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`;
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    let sessionCreated = false;
    const events = [];

    const timeout = setTimeout(() => {
      ws.close();
      log(model, `⏱️ FC テスト完了 (タイムアウト) — 受信イベント: ${events.join(', ')}`);
      resolve({ model, status: 'TIMEOUT', events });
    }, 15000);

    ws.on('open', () => {
      log(model, '📡 FC テスト: 接続成功');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        events.push(msg.type);

        if (msg.type === 'session.created') {
          sessionCreated = true;
          log(model, '  session.created — tools 付き session.update を送信...');

          // tools 付き session.update を送信
          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text'],
              voice: 'Tina',
              instructions: 'You are a helpful assistant. Use the get_weather tool when asked about weather.',
              tools: TOOLS,
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
            },
          }));
        } else if (msg.type === 'session.updated') {
          log(model, '  session.updated — tools 受理されたか確認中...');
          const sessionTools = msg.session?.tools;
          if (sessionTools && sessionTools.length > 0) {
            log(model, `  ✅ Function Calling サポート確認！ tools: ${JSON.stringify(sessionTools)}`);
          } else {
            log(model, `  ⚠️ session.updated に tools が含まれていない: ${JSON.stringify(msg.session || {}).slice(0, 200)}`);
          }

          // テキストメッセージで function call をトリガー
          log(model, '  テキスト送信: "东京の天気を教えて"...');
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: '东京今天天气怎么样？' }],
            },
          }));
          ws.send(JSON.stringify({ type: 'response.create' }));
        } else if (msg.type === 'response.function_call_arguments.done') {
          log(model, `  🎉 Function Call 発動！ name=${msg.name} args=${msg.arguments}`);
          clearTimeout(timeout);
          ws.close();
          resolve({ model, status: 'FC_SUPPORTED', functionCall: msg });
        } else if (msg.type === 'response.function_call_arguments.delta') {
          log(model, `  📝 FC delta: ${msg.delta}`);
        } else if (msg.type === 'response.done') {
          const output = msg.response?.output;
          const hasFc = output?.some?.(o => o.type === 'function_call');
          if (hasFc) {
            log(model, `  🎉 response.done に function_call あり！`);
            clearTimeout(timeout);
            ws.close();
            resolve({ model, status: 'FC_SUPPORTED', response: msg });
          } else {
            log(model, `  ℹ️ response.done — function_call なし（テキスト応答）`);
            log(model, `     output types: ${output?.map?.(o => o.type)?.join(', ') || 'N/A'}`);
            clearTimeout(timeout);
            ws.close();
            resolve({ model, status: 'FC_NOT_TRIGGERED', events });
          }
        } else if (msg.type === 'error') {
          log(model, `  ❌ エラー: ${msg.error?.message || JSON.stringify(msg.error)}`);
          // tools 非対応エラーかどうか確認
          if (msg.error?.message?.includes('tool') || msg.error?.message?.includes('function')) {
            log(model, `  ⛔ Function Calling 明示的に非対応`);
            clearTimeout(timeout);
            ws.close();
            resolve({ model, status: 'FC_NOT_SUPPORTED', error: msg.error });
          }
        } else if (msg.type === 'response.text.delta' || msg.type === 'response.audio_transcript.delta') {
          // テキスト応答のストリーミング（FC なし）
        }
      } catch (e) {
        // binary frame
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      log(model, `❌ 接続エラー: ${err.message}`);
      resolve({ model, status: 'CONNECT_ERROR', error: err.message });
    });
  });
}

// ─── Test 3: HTTP API Function Calling テスト ────────────────────
async function testHttpFunctionCalling(model) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: '东京今天天气怎么样？' },
      ],
      tools: TOOLS,
      stream: true, // qwen3-omni-flash は streaming only
      modalities: ['text'], // テキストのみ
    });

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/compatible-mode/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
    };

    log(model, `📡 HTTP API テスト (stream=true, tools付き)...`);

    const req = https.request(options, (res) => {
      let data = '';
      let hasFunctionCall = false;
      let errorMsg = '';

      res.on('data', (chunk) => {
        data += chunk.toString();
      });

      res.on('end', () => {
        // SSE パース
        const lines = data.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const obj = JSON.parse(jsonStr);
            const delta = obj.choices?.[0]?.delta;
            if (delta?.tool_calls) {
              hasFunctionCall = true;
              log(model, `  🎉 Function Call 発動！ tool_calls: ${JSON.stringify(delta.tool_calls).slice(0, 200)}`);
            }
            if (obj.error) {
              errorMsg = obj.error.message || JSON.stringify(obj.error);
            }
          } catch (e) {
            // ignore parse errors
          }
        }

        // Non-streaming error check
        if (!lines.length) {
          try {
            const obj = JSON.parse(data);
            if (obj.error) {
              errorMsg = obj.error.message || JSON.stringify(obj.error);
            }
            if (obj.choices?.[0]?.message?.tool_calls) {
              hasFunctionCall = true;
              log(model, `  🎉 Function Call 発動！`);
            }
          } catch (e) {}
        }

        if (errorMsg) {
          log(model, `  ❌ エラー: ${errorMsg}`);
          resolve({ model, status: 'ERROR', error: errorMsg });
        } else if (hasFunctionCall) {
          log(model, `  ✅ HTTP Function Calling サポート確認！`);
          resolve({ model, status: 'FC_SUPPORTED' });
        } else {
          log(model, `  ⚠️ Function Call トリガーされず（テキスト応答）`);
          // 最初の数行を表示
          const preview = lines.slice(0, 3).map(l => l.slice(6, 100)).join(' | ');
          log(model, `     preview: ${preview}`);
          resolve({ model, status: 'FC_NOT_TRIGGERED' });
        }
      });
    });

    req.on('error', (err) => {
      log(model, `  ❌ HTTP エラー: ${err.message}`);
      resolve({ model, status: 'HTTP_ERROR', error: err.message });
    });

    req.setTimeout(30000, () => {
      log(model, `  ⏱️ タイムアウト`);
      req.destroy();
      resolve({ model, status: 'TIMEOUT' });
    });

    req.write(body);
    req.end();
  });
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Qwen3.5-Omni テストスイート');
  console.log(`   API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
  console.log(`   Date: ${new Date().toISOString()}`);

  // ── Test 1: Realtime 接続テスト ──
  separator('Test 1: Realtime WebSocket 接続テスト');
  const connResults = [];
  for (const model of REALTIME_MODELS) {
    const result = await testRealtimeConnection(model);
    connResults.push(result);
  }

  // ── Test 2: Realtime Function Calling テスト ──
  separator('Test 2: Realtime Function Calling テスト');
  const fcResults = [];
  // 接続成功したモデルのみテスト
  const connectedModels = connResults.filter(r => r.status === 'OK').map(r => r.model);
  if (connectedModels.length === 0) {
    log('SKIP', '接続成功したモデルがないため FC テストをスキップ');
  } else {
    for (const model of connectedModels) {
      const result = await testRealtimeFunctionCalling(model);
      fcResults.push(result);
    }
  }

  // ── Test 3: HTTP API Function Calling テスト ──
  separator('Test 3: HTTP API Function Calling テスト');
  const httpResults = [];
  for (const model of HTTP_MODELS) {
    const result = await testHttpFunctionCalling(model);
    httpResults.push(result);
  }

  // ── Summary ──
  separator('テスト結果サマリー');
  console.log('┌─────────────────────────────────────┬──────────┬──────────────────┐');
  console.log('│ モデル                               │ 接続     │ Function Calling │');
  console.log('├─────────────────────────────────────┼──────────┼──────────────────┤');

  for (const r of connResults) {
    const conn = r.status === 'OK' ? '✅' : '❌';
    const fc = fcResults.find(f => f.model === r.model);
    let fcStatus = '-';
    if (fc) {
      fcStatus = fc.status === 'FC_SUPPORTED' ? '✅ YES' :
                 fc.status === 'FC_NOT_SUPPORTED' ? '❌ NO' :
                 fc.status === 'FC_NOT_TRIGGERED' ? '⚠️ 不明' : fc.status;
    }
    console.log(`│ ${r.model.padEnd(35)} │ ${conn.padEnd(8)} │ ${fcStatus.padEnd(16)} │`);
  }

  console.log('├─────────────────────────────────────┼──────────┼──────────────────┤');
  for (const r of httpResults) {
    const fcStatus = r.status === 'FC_SUPPORTED' ? '✅ YES' :
                     r.status === 'ERROR' ? `❌ ${r.error?.slice(0, 20)}` :
                     r.status === 'FC_NOT_TRIGGERED' ? '⚠️ 不明' : r.status;
    console.log(`│ ${r.model.padEnd(35)} │ HTTP     │ ${fcStatus.padEnd(16)} │`);
  }
  console.log('└─────────────────────────────────────┴──────────┴──────────────────┘');
}

main().catch(console.error);
