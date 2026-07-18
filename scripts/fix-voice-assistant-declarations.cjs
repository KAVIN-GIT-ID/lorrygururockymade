const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/VoiceAssistant.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines
content = content.replace(/\r\n/g, '\n');

// Fix signal declarations that were incorrectly replaced with function call parentheses
content = content.replace("const [activeFlow(), setActiveFlow]", "const [activeFlow, setActiveFlow]");
content = content.replace("const [currentStepIdx(), setCurrentStepIdx]", "const [currentStepIdx, setCurrentStepIdx]");
content = content.replace("const [messages(), setMessages]", "const [messages, setMessages]");
content = content.replace("const [formData(), setFormData]", "const [formData, setFormData]");
content = content.replace("const [isListening(), setIsListening]", "const [isListening, setIsListening]");
content = content.replace("const [isSpeaking(), setIsSpeaking]", "const [isSpeaking, setIsSpeaking]");
content = content.replace("const [isMuted(), setIsMuted]", "const [isMuted, setIsMuted]");
content = content.replace("const [transcript(), setTranscript]", "const [transcript, setTranscript]");
content = content.replace("const [textInput(), setTextInput]", "const [textInput, setTextInput]");
content = content.replace("const [recognitionError(), setRecognitionError]", "const [recognitionError, setRecognitionError]");

// Restore CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully repaired VoiceAssistant.tsx signal declarations');
