const fs = require('fs');

const logPath = 'C:/Users/infimove/.gemini/antigravity-ide/brain/3beb5390-0a2f-4a29-a102-32196d4a2dbf/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (line.trim()) {
    try {
      const parsed = JSON.parse(line);
      // Let's search for the step that viewed BackendDashboard.tsx around lines 2601-2735
      if (parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'view_file' && tc.args.AbsolutePath.includes('BackendDashboard.tsx')) {
            console.log(`Step ${parsed.step_index}: view_file args:`, tc.args);
          }
        }
      }
      if (parsed.step_index === 1563 || parsed.step_index === 1564 || parsed.step_index === 1573 || parsed.step_index === 1574) {
        console.log(`Step ${parsed.step_index} output:`);
        console.log(JSON.stringify(parsed.content || parsed.tool_calls || parsed));
      }
    } catch (e) {
      // ignore
    }
  }
}
