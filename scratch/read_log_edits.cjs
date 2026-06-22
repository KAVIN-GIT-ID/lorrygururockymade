const fs = require('fs');

const logPath = 'C:/Users/infimove/.gemini/antigravity-ide/brain/a8c53ba6-3f21-4d23-9c4e-8b1d2cb32db4/.system_generated/logs/transcript.jsonl';
if (!fs.existsSync(logPath)) {
  console.log("No transcript file found at " + logPath);
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (line.trim()) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'replace_file_content' || tc.name === 'write_to_file') {
            console.log(`Step ${parsed.step_index}: ${tc.name} target: ${tc.args.TargetFile}`);
            console.log(`Instruction: ${tc.args.Instruction || tc.args.Description}`);
            console.log("-----------------------------------------");
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}
