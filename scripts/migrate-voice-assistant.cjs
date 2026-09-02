const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/VoiceAssistant.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines
content = content.replace(/\r\n/g, '\n');

// 1. Fix state & refs declarations
content = content.replace("const [formData, setFormData] = useState<Record<string, any>>({});", 
  "const [formData, setFormData] = createSignal<Record<string, any>>({});");
content = content.replace("const messagesEndRef = useRef<HTMLDivElement>(null);", 
  "let messagesEndRef: HTMLDivElement | undefined;");
content = content.replace("const recognitionRef = useRef<any>(null);", 
  "let recognitionRef: any = null;");
content = content.replace("const speechTimeoutRef = useRef<any>(null);", 
  "let speechTimeoutRef: any = null;");

// 2. Fix ref usages (.current)
content = content.replace(/\bmessagesEndRef\.current\b/g, "messagesEndRef");
content = content.replace(/\brecognitionRef\.current\b/g, "recognitionRef");
content = content.replace(/\bspeechTimeoutRef\.current\b/g, "speechTimeoutRef");

// 3. Fix state getter usages
content = content.replace(/\bformData\.(\w+)\b/g, "formData().$1");
content = content.replace(/\bformData\s*\[/g, "formData()[");
content = content.replace(/\bformData\b(?![(]|=|\s*:)/g, "formData()");

content = content.replace(/\bactiveFlow\b(?![(]|=|\s*:)/g, "activeFlow()");
content = content.replace(/\bcurrentStepIdx\b(?![(]|=|\s*:)/g, "currentStepIdx()");
content = content.replace(/\bmessages\b(?![(]|=|\s*:)/g, "messages()");
content = content.replace(/\bisListening\b(?![(]|=|\s*:)/g, "isListening()");
content = content.replace(/\bisSpeaking\b(?![(]|=|\s*:)/g, "isSpeaking()");
content = content.replace(/\bisMuted\b(?![(]|=|\s*:)/g, "isMuted()");
content = content.replace(/\btranscript\b(?![(]|=|\s*:)/g, "transcript()");
content = content.replace(/\btextInput\b(?![(]|=|\s*:)/g, "textInput()");
content = content.replace(/\brecognitionError\b(?![(]|=|\s*:)/g, "recognitionError()");

// Restore CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully migrated VoiceAssistant.tsx to SolidJS');
