const fs = require('fs');

const logPath = "C:\\Users\\infimove\\.gemini\\antigravity-ide\\brain\\e54901a1-744d-4e15-9ef3-e8cb32e8a86e\\.system_generated\\logs\\transcript.jsonl";

console.log("Searching transcript.jsonl for edits to TripForm.tsx...");

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("TripForm.tsx")) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          obj.tool_calls.forEach(tc => {
            const args = tc.function ? tc.function.arguments : null;
            if (args) {
              try {
                const parsed = JSON.parse(args);
                if (parsed.TargetFile && parsed.TargetFile.includes("TripForm.tsx")) {
                  console.log(`\n--- Edit found on line ${i+1} ---`);
                  console.log(`Tool: ${tc.function.name}`);
                  console.log(`Instruction: ${parsed.Instruction || parsed.Description || 'None'}`);
                  if (parsed.ReplacementContent) {
                    console.log(`TargetContent:\n${parsed.TargetContent}`);
                    console.log(`ReplacementContent:\n${parsed.ReplacementContent}`);
                  }
                  if (parsed.ReplacementChunks) {
                    parsed.ReplacementChunks.forEach((chunk, idx) => {
                      console.log(`Chunk ${idx+1}:`);
                      console.log(`  TargetContent:\n${chunk.TargetContent}`);
                      console.log(`  ReplacementContent:\n${chunk.ReplacementContent}`);
                    });
                  }
                }
              } catch (e) {}
            }
          });
        }
      } catch (e) {}
    }
  }
} catch (e) {
  console.error(e);
}
