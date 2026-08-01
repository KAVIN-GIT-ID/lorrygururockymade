import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

import { Truck, Driver, Office, Account, TripEntry, ExpenseEntry } from '../types';
import { parseSpokenNumber, matchClosestOption, normalizeString } from '../utils/speechUtils';
import { indianCities } from './indianCities';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, RefreshCw, X, Send, 
  Check, Play, CornerDownLeft, AlertCircle, HelpCircle
} from 'lucide-solid';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  drivers: Driver[];
  offices: Office[];
  accounts: Account[];
  existingTripNos: string[];
  onSubmitTrip: (trip: Omit<TripEntry, 'id'>) => void;
  onSubmitExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
  voiceLang?: string;
}

interface Message {
  sender: 'assistant' | 'user';
  text: string;
  timestamp: Date;
  status?: 'success' | 'error' | 'neutral';
}

interface Step {
  key: string;
  question: string;
  type: 'choice' | 'number' | 'text' | 'confirm';
  getOptions?: () => string[];
  validateAndParse: (input: string) => { valid: boolean; value?: any; error?: string };
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'en-IN': {
    greeting: "Hello! I am your Antigravity Assistant. I can help you register a trip or expense. What would you like to create?",
    cancelText: "Ok, closing voice assistant.",
    abortText: "Aborted entry creation.",
    successTrip: "Trip created successfully! Code: {code}",
    successTripVoice: "Trip created successfully! Your trip code is {code}.",
    successExpense: "Expense voucher of rupees {amount} saved!",
    successExpenseVoice: "Expense voucher of rupees {amount} saved successfully!",
    tripHeader: "Initiating Trip Ledger. ",
    expenseHeader: "Initiating Expense Voucher. ",
    fallbackMsg: "Sorry, I can only help you register a trip or expense. Please say 'create a trip' or 'create an expense'.",
    fallbackConfirm: "Would you like to save? Say 'save' to confirm, or 'cancel' to abort."
  },
  'hi-IN': {
    greeting: "नमस्ते! मैं आपका एंटीग्रेविटी असिस्टेंट हूँ। मैं यात्रा या खर्च दर्ज करने में आपकी मदद कर सकता हूँ। आप क्या बनाना चाहेंगे?",
    cancelText: "ठीक है, वॉइस असिस्टेंट बंद कर रहे हैं।",
    abortText: "प्रविष्टि बनाना रद्द कर दिया गया है।",
    successTrip: "यात्रा सफलतापूर्वक बनाई गई! कोड: {code}",
    successTripVoice: "यात्रा सफलतापूर्वक बनाई गई! आपका यात्रा कोड है {code}।",
    successExpense: "रुपये {amount} का खर्च वाउचर सहेज लिया गया है!",
    successExpenseVoice: "रुपये {amount} का खर्च वाउचर सफलतापूर्वक सहेज लिया गया है!",
    tripHeader: "यात्रा बही खाता शुरू कर रहे हैं। ",
    expenseHeader: "खर्च वाउचर शुरू कर रहे हैं। ",
    fallbackMsg: "क्षमा करें, मैं केवल यात्रा या खर्च दर्ज करने में मदद कर सकता हूँ। कृपया 'यात्रा बनाएँ' या 'खर्च दर्ज करें' बोलें।",
    fallbackConfirm: "क्या आप इसे सहेजना चाहते हैं? पुष्टि करने के लिए 'हाँ' या 'सहेजें' बोलें, या रद्द करने के लिए 'नहीं' बोलें।"
  },
  'ta-IN': {
    greeting: "வணக்கம்! நான் உங்கள் ஆண்டிகிராவிட்டி உதவியாளர். ஒரு பயணம் அல்லது செலவை பதிவு செய்ய நான் உங்களுக்கு உதவ முடியும். நீங்கள் எதை உருவாக்க விரும்புகிறீர்கள்?",
    cancelText: "சரி, குரல் உதவியாளரை மூடுகிறேன்.",
    abortText: "பதிவு உருவாக்கம் ரத்து செய்யப்பட்டது.",
    successTrip: "பயணம் வெற்றிகரமாக உருவாக்கப்பட்டது! குறியீடு: {code}",
    successTripVoice: "பயணம் வெற்றிகரமாக உருவாக்கப்பட்டது! உங்கள் பயணக் குறியீடு {code} ஆகும்.",
    successExpense: "ரூபாய் {amount} க்கான செலவு வவுச்சர் சேமிக்கப்பட்டது!",
    successExpenseVoice: "ரூபாய் {amount} க்கான செலவு வவுச்சர் வெற்றிகரமாக சேமிக்கப்பட்டது!",
    tripHeader: "பயணப் பதிவேட்டைத் தொடங்குகிறேன். ",
    expenseHeader: "செலவு வவுச்சரைத் தொடங்குகிறேன். ",
    fallbackMsg: "மன்னிக்கவும், ஒரு பயணம் அல்லது செலவை பதிவு செய்ய மட்டுமே என்னால் உதவ முடியும். தயவுசெய்து 'பயணத்தை உருவாக்கு' அல்லது 'செலவை உருவாக்கு' என்று சொல்லுங்கள்.",
    fallbackConfirm: "நீங்கள் சேமிக்க விரும்புகிறீர்களா? உறுதிப்படுத்த 'சேமி' என்று சொல்லுங்கள், அல்லது ரத்து செய்ய 'ரத்து செய்' என்று சொல்லுங்கள்."
  },
  'te-IN': {
    greeting: "నమస్కారం! నేను మీ యాంటీగ్రావిటీ సహాయకుడిని. ప్రయాణం లేదా ఖర్చును నమోదు చేయడంలో నేను సహాయపడగలను. మీరు దేన్ని సృష్టించాలనుకుంటున్నారు?",
    cancelText: "సరే, వాయిస్ అసిస్టెంట్‌ని మూసివేస్తున్నాను.",
    abortText: "నమోదు సృష్టి రద్దు చేయబడింది.",
    successTrip: "ప్రయాణం విజయవంతంగా సృష్టించబడింది! కోడ్: {code}",
    successTripVoice: "ప్రయాణం విజయవంతంగా సృష్టించబడింది! మీ ప్రయాణ కోడ్ {code}.",
    successExpense: "రూపాయలు {amount} ఖర్చు వోచర్ విజయవంతంగా సేవ్ చేయబడింది!",
    successExpenseVoice: "రూపాయలు {amount} ఖర్చు వోచర్ విజయవంతంగా సేవ్ చేయబడింది!",
    tripHeader: "ప్రయాణ లెడ్జర్‌ను ప్రారంభిస్తున్నాను. ",
    expenseHeader: "ఖర్చు వోచర్‌ను ప్రారంభిస్తున్నాను. ",
    fallbackMsg: "క్షమించండి, నేను ప్రయాణం లేదా ఖర్చును నమోదు చేయడంలో మాత్రమే సహాయపడగలను. దయచేసి 'ప్రయాణాన్ని సృష్టించు' లేదా 'ఖర్చును సృష్టించు' అని చెప్పండి.",
    fallbackConfirm: "మీరు సేవ్ చేయాలనుకుంటున్నారా? నిర్ధారించడానికి 'సేవ్' అని చెప్పండి, లేదా రద్దు చేయడానికి 'రద్దు చేయి' అని చెప్పండి."
  },
  'kn-IN': {
    greeting: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಆಂಟಿಗ್ರಾವಿಟಿ ಸಹಾಯಕ. ಒಂದು ಪ್ರಯಾಣ ಅಥವಾ ಖರ್ಚನ್ನು ನೋಂದಾಯಿಸಲು ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ನೀವು ಏನನ್ನು ರಚಿಸಲು ಬಯಸುತ್ತೀರಿ?",
    cancelText: "ಸರಿ, ವಾಯ್ಸ್ ಅಸಿಸ್ಟೆಂಟ್ ಅನ್ನು ಮುಚ್ಚುತ್ತಿದ್ದೇನೆ.",
    abortText: "ದಾಖಲೆ ರಚನೆಯನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ.",
    successTrip: "ಪ್ರಯಾಣವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ! ಕೋಡ್: {code}",
    successTripVoice: "ಪ್ರಯಾಣವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ! ನಿಮ್ಮ ಪ್ರಯಾಣದ ಕೋಡ್ {code} ಆಗಿದೆ.",
    successExpense: "ರೂಪಾಯಿ {amount} ಗಳ ಖರ್ಚು ವೋಚರ್ ಅನ್ನು ಉಳಿಸಲಾಗಿದೆ!",
    successExpenseVoice: "ರೂಪಾಯಿ {amount} ಗಳ ಖರ್ಚು ವೋಚರ್ ಅನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಉಳಿಸಲಾಗಿದೆ!",
    tripHeader: "ಪ್ರಯಾಣದ ಲೆಡ್ಜರ್ ಅನ್ನು ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ. ",
    expenseHeader: "ಖರ್ಚು ವೋಚರ್ ಅನ್ನು ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ. ",
    fallbackMsg: "ಕ್ಷಮಿಸಿ, ನಾನು ಕೇವಲ ಪ್ರಯಾಣ ಅಥವಾ ಖರ್ಚನ್ನು ನೋಂದಾಯಿಸಲು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ದಯವಿಟ್ಟು 'ಪ್ರಯಾಣವನ್ನು ರಚಿಸಿ' ಅಥವಾ 'ಖರ್ಚನ್ನು ರಚಿಸಿ' ಎಂದು ಹೇಳಿ.",
    fallbackConfirm: "ನೀವು ಉಳಿಸಲು ಬಯಸುವಿರಾ? ಖಚಿತಪಡಿಸಲು 'ಉಳಿಸು' ಎಂದು ಹೇಳಿ, अथवा ರದ್ದುಗೊಳಿಸಲು 'ರದ್ದುಮಾಡು' ಎಂದು ಹೇಳಿ."
  },
  'mr-IN': {
    greeting: "नमस्कार! मी आपला अँटीग्रॅव्हिटी असिस्टंट आहे. मी प्रवास किंवा खर्च नोंदणी करण्यास मदत करू शकतो. आपण काय तयार करू इच्छिता?",
    cancelText: "ठीक आहे, व्हॉईस असिस्टंट बंद करत आहे.",
    abortText: "नोंदणी रद्द केली आहे.",
    successTrip: "प्रवास यशस्वीरित्या तयार केला! कोड: {code}",
    successTripVoice: "प्रवास यशस्वीरित्या तयार केला! आपला प्रवास कोड {code} आहे.",
    successExpense: "रुपये {amount} चा खर्च व्हाउचर जतन केला आहे!",
    successExpenseVoice: "रुपये {amount} चा खर्च व्हाउचर यशस्वीरित्या जतन केला आहे!",
    tripHeader: "प्रवास नोंदवही सुरू करत आहे. ",
    expenseHeader: "खर्च व्हाउचर सुरू करत आहे. ",
    fallbackMsg: "क्षमस्व, मी फक्त प्रवास किंवा खर्च नोंदणी करण्यात मदत करू शकतो. कृपया 'प्रवास तयार करा' किंवा 'खर्च तयार करा' म्हणा.",
    fallbackConfirm: "आपण जतन करू इच्छिता? पुष्टी करण्यासाठी 'जतन करा' किंवा 'होय' म्हणा, किंवा रद्द करण्यासाठी 'नाही' म्हणा."
  }
};

export default function VoiceAssistant({
  isOpen,
  onClose,
  trucks,
  drivers,
  offices,
  accounts,
  existingTripNos,
  onSubmitTrip,
  onSubmitExpense,
  voiceLang = 'en-IN'
}: VoiceAssistantProps) {
  const [activeFlow, setActiveFlow] = createSignal<'trip' | 'expense' | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = createSignal<number>(-1);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [formData, setFormData] = createSignal<Record<string, any>>({});
  const [isListening, setIsListening] = createSignal(false);
  const [isSpeaking, setIsSpeaking] = createSignal(false);
  const [isMuted, setIsMuted] = createSignal(false);
  const [transcript, setTranscript] = createSignal('');
  const [textInput, setTextInput] = createSignal('');
  const [recognitionError, setRecognitionError] = createSignal<string | null>(null);

  let messagesEndRef: HTMLDivElement | undefined;
  let recognitionRef: any = null;
  let speechTimeoutRef: any = null;

  const langCode = TRANSLATIONS[voiceLang] ? voiceLang : 'en-IN';
  const t = TRANSLATIONS[langCode];

  const parseConfirmInput = (input: string): 'save' | 'cancel' | null => {
    const normalized = input.toLowerCase().trim();
    const yesWords = [
      'save', 'confirm', 'yes', 'ok',
      'हाँ', 'हा', 'सहेज', 'पुष्टि',
      'ஆம்', 'சேமி', 'aam', 'semi',
      'అవును', 'సేవ్', 'avunu',
      'ಹೌದು', 'ಉಳಿಸು', 'haudu', 'ulisu',
      'होय', 'जतन', 'hoy', 'jatan'
    ];
    const noWords = [
      'cancel', 'abort', 'no',
      'नहीं', 'ना', 'रद्द', 'बंद',
      'இல்லை', 'வேண்டாம்', 'ரத்து', 'illai', 'vendaam',
      'వద్దు', 'కాదు', 'voddu', 'vaddu', 'kaadu', 'raddu',
      'ಇಲ್ಲ', 'ಬೇಡ', 'illa', 'beda',
      'नाही', 'नको', 'nahie', 'nahi', 'nako', 'radd'
    ];

    if (yesWords.some(w => normalized.includes(w))) {
      return 'save';
    }
    if (noWords.some(w => normalized.includes(w))) {
      return 'cancel';
    }
    return null;
  };

  const localizedQuestion = (key: string, defaultQuestion: string) => {
    const questions: Record<string, Record<string, string>> = {
      'hi-IN': {
        truckNo: "इस यात्रा के लिए कौन सा ट्रक है?",
        driverName: "इस यात्रा के लिए ड्राइवर कौन है?",
        startingKM: "शुरुआती ओडोमीटर किलोमीटर क्या है?",
        routeFrom: "माल कहाँ से लोड किया जा रहा है?",
        routeTo: "माल कहाँ पहुँचाया जा रहा है?",
        income: "माल भाड़ा किराया कितने रुपये है?",
        officeName: "किस ऑफिस ब्रांच ने इस लोड को संभाला?",
        notes: "क्या आपके पास इस यात्रा के लिए कोई टिप्पणी है? यदि नहीं तो 'skip' बोलें।",
        confirm: "पुष्टि करने के लिए 'हाँ' या 'save' बोलें, या रद्द करने के लिए 'नहीं' बोलें।",
        
        truckNo_expense: "यह खर्च किस ट्रक के लिए है?",
        expenseType: "यह किस प्रकार का खर्च है? जैसे: Fuel, Food, Toll।",
        amount: "खर्च की राशि कितने रुपये है?",
        paymentMode: "आपने किस बही खाते का उपयोग किया? जैसे: Cash, Bank।",
        confirm_expense: "पुष्टि करने के लिए 'हाँ' या 'save' बोलें, या रद्द करने के लिए 'नहीं' बोलें।"
      },
      'ta-IN': {
        truckNo: "இந்தப் பயணத்திற்கான லாரி எது?",
        driverName: "இந்தப் பயணத்திற்கான ஓட்டுநர் யார்?",
        startingKM: "தொடக்க ஓடோமீட்டர் கிலோமீட்டர் என்ன?",
        routeFrom: "சரக்கு எங்கிருந்து ஏற்றப்படுகிறது?",
        routeTo: "சரக்கு எங்கு கொண்டு செல்லப்படுகிறது?",
        income: "வாடகை கட்டணம் எத்தனை ரூபாய்?",
        officeName: "எந்த அலுவலகக் கிளை இந்த சுமையை கையாண்டது?",
        notes: "இந்தப் பயணத்திற்கு ஏதேனும் குறிப்புகள் உள்ளதா? இல்லை என்றால் 'skip' என்று சொல்லுங்கள்.",
        confirm: "உறுதிப்படுத்த 'ஆம்' அல்லது 'சேமி' என்று சொல்லுங்கள், அல்லது ரத்து செய்ய 'இல்லை' என்று சொல்லுங்கள்.",
        
        truckNo_expense: "இந்த செலவு எந்த லாரிக்கானது?",
        expenseType: "இது என்ன வகையான செலவு? உதாரணமாக: எரிபொருள், உணவு, டோல் கட்டணம்.",
        amount: "செலவுத் தொகை எத்தனை ரூபாய்?",
        paymentMode: "நீங்கள் எந்த கணக்கைப் பயன்படுத்தினீர்கள்? உதாரணமாக: ரொக்கம், வங்கி.",
        confirm_expense: "உறுதிப்படுத்த 'ஆம்' அல்லது 'சேமி' என்று சொல்லுங்கள், அல்லது ரத்து செய்ய 'இல்லை' என்று சொல்லுங்கள்."
      },
      'te-IN': {
        truckNo: "ఈ ప్రయాణానికి ఏ ట్రక్ ఉపయోగించబడుతోంది?",
        driverName: "ఈ ప్రయాణానికి డ్రైవర్ ఎవరు?",
        startingKM: "ప్రారంభ ఓడోమీటర్ కిలోమీటర్ ఎంత?",
        routeFrom: "సరుకు ఎక్కడ నుండి లోడ్ చేయబడుతోంది?",
        routeTo: "సరుకు ఎక్కడికి రవాణా చేయబడుతోంది?",
        income: "అద్దె కిరాయి ఎన్ని రూపాయలు?",
        officeName: "ఏ ఆఫీస్ బ్రాంచ్ ఈ లోడ్‌ను నిర్వహించింది?",
        notes: "ఈ ప్రయాణంలో ఏవైనా నోట్స్ ఉన్నాయా? లేకపోతే 'skip' అని చెప్పండి.",
        confirm: "నిర్ధారించడానికి 'అవును' లేదా 'సేవ్' అని చెప్పండి, లేదా రద్దు చేయడానికి 'వద్దు' అని చెప్పండి.",
        
        truckNo_expense: "ఈ ఖర్చు ఏ ట్రక్కుకు సంబంధించినది?",
        expenseType: "ఇది ఏ రకమైన ఖर्चు? ఉదాహरणకు: ఇంధనం, ఆహారం, టోల్.",
        amount: "ఖర్చు మొత్తం ఎన్ని రూపాయలు?",
        paymentMode: "మీరు ఏ పద్ధతి ద్వారా చెల్లించారు? ఉదాహరణకు: నగదు, బ్యాంక్.",
        confirm_expense: "నిర్ధారించడానికి 'అవును' లేదా 'సేవ్' అని చెప్పండి, లేదా రద్దు చేయడానికి 'వద్దు' అని చెప్పండి."
      },
      'kn-IN': {
        truckNo: "ಈ ಪ್ರಯಾಣಕ್ಕಾಗಿ ಯಾವ ಟ್ರಕ್ ಇದೆ?",
        driverName: "ಈ ಪ್ರಯಾಣಕ್ಕೆ ಚಾಲಕ ಯಾರು?",
        startingKM: "ಪ್ರಾರಂಭದ ಓಡೋಮೀಟರ್ ಕಿಲೋಮೀಟರ್ ಎಷ್ಟು?",
        routeFrom: "ಸರಕು ಎಲ್ಲಿಂದ ಲೋಡ್ ಆಗುತ್ತಿದೆ?",
        routeTo: "ಸರಕು ಎಲ್ಲಿಗೆ ತಲುಪುತ್ತಿದೆ?",
        income: "ಬಾಡಿಗೆ ಹಣ ಎಷ್ಟು ರೂಪಾಯಿ?",
        officeName: "ಯಾವ ಕಚೇರಿ ಶಾಖೆಯು ಈ ಲೋಡ್ ಅನ್ನು ನಿರ್ವಹಿಸಿದೆ?",
        notes: "ಈ ಪ್ರಯಾಣಕ್ಕೆ ಯಾವುದೇ ಟಿಪ್ಪಣಿಗಳು ಇವೆಯೇ? ಇಲ್ಲದಿದ್ದರೆ 'skip' ಎಂದು ಹೇಳಿ.",
        confirm: "ಖಚಿತಪಡಿಸಲು 'ಹೌದು' ಅಥವಾ 'ಉಳಿಸು' ಎಂದು ಹೇಳಿ, ಅಥವಾ ರದ್ದುಗೊಳಿಸಲು 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ.",
        
        truckNo_expense: "ಈ ಖರ್ಚು ಯಾವ ಟ್ರಕ್‌ಗೆ ಸಂಬಂಧಿಸಿದೆ?",
        expenseType: "ಇದು ಯಾವ ರೀತಿಯ ಖರ್ಚು? ಉದಾಹರಣೆಗೆ: ಇಂಧನ, ಆಹಾರ, ಟೋಲ್.",
        amount: "ಖರ್ಚಿನ ಮೊತ್ತ ಎಷ್ಟು ರೂಪಾಯಿ?",
        paymentMode: "ನೀವು ಯಾವ ಖಾತೆಯನ್ನು ಬಳಸಿದ್ದೀರಿ? ಉದಾಹರಣೆಗೆ: ನಗದು, ಬ್ಯಾಂಕ್.",
        confirm_expense: "ಖಚಿತಪಡಿಸಲು 'ಹೌದು' ಅಥವಾ 'ಉಳಿಸು' ಎಂದು ಹೇಳಿ, ಅಥವಾ ರದ್ದುಗೊಳಿಸಲು 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ."
      },
      'mr-IN': {
        truckNo: "या प्रवासासाठी कोणती ट्रक आहे?",
        driverName: "या प्रवासासाठी ड्रायव्हर कोण आहे?",
        startingKM: "सुरुवातीचे ओडोमीटर किलोमीटर किती आहे?",
        routeFrom: "माल कोठून लोड केला जात आहे?",
        routeTo: "माल कोठे पोहोचवला जात आहे?",
        income: "भाडे किती रुपये आहे?",
        officeName: "कोणत्या ऑफिस ब्रँचने हा लोड सांभाळला?",
        notes: "या प्रवासासाठी काही टीप आहे का? नसल्यास 'skip' म्हणा.",
        confirm: "पुष्टी करण्यासाठी 'होय' किंवा 'जतन करा' म्हणा, किंवा रद्द करण्यासाठी 'नाही' म्हणा.",
        
        truckNo_expense: "हा खर्च कोणत्या ट्रकसाठी आहे?",
        expenseType: "हा कोणत्या प्रकारचा खर्च आहे? जसे की: इंधन, अन्न, टोल.",
        amount: "खर्चाची रक्कम किती रुपये आहे?",
        paymentMode: "आपण कोणत्या खात्याचा वापर केला? जसे की: रोख, बँक.",
        confirm_expense: "पुष्टी करण्यासाठी 'होय' किंवा 'जतन करा' म्हणा, किंवा रद्द करण्यासाठी 'नाही' म्हणा."
      }
    };
    return questions[langCode]?.[key] || defaultQuestion;
  };

  const localizedError = (key: string, defaultError: string) => {
    const errors: Record<string, Record<string, string>> = {
      'hi-IN': {
        truckNo: "क्षमा करें, मुझे वह ट्रक नहीं मिला। कृपया ट्रक नंबर फिर से बताएं।",
        driverName: "क्षमा करें, मुझे वह ड्राइवर नहीं मिला। कृपया ड्राइवर का नाम फिर से बताएं।",
        startingKM: "मुझे एक वैध संख्या नहीं मिली। कृपया शुरुआती किलोमीटर फिर से बताएं।",
        officeName: "क्षमा करें, मुझे वह ऑफिस ब्रांच नहीं मिली। कृपया फिर से बताएं।",
        confirm: "पुष्टि करने के लिए 'हाँ' कहें, या रद्द करने के लिए 'नहीं' कहें।",
        amount: "कृपया रुपये में एक वैध राशि बताएं।"
      },
      'ta-IN': {
        truckNo: "மன்னிக்கவும், அந்த லாரியை என்னால் கண்டுபிடிக்க முடியவில்லை. தயவுசெய்து லாரி எண்ணை மீண்டும் சொல்லுங்கள்.",
        driverName: "மன்னிக்கவும், அந்த ஓட்டுநரை என்னால் கண்டுபிடிக்க முடியவில்லை. தயவுசெய்து ஓட்டுநர் பெயரை மீண்டும் சொல்லுங்கள்.",
        startingKM: "எனக்கு சரியான எண் கிடைக்கவில்லை. தயவுசெய்து தொடக்க கிலோமீட்டரை மீண்டும் சொல்லுங்கள்.",
        officeName: "மன்னிக்கவும், அந்த அலுவலகக் கிளையை என்னால் கண்டுபிடிக்க முடியவில்லை. தயவுசெய்து மீண்டும் சொல்லுங்கள்.",
        confirm: "உறுதிப்படுத்த 'ஆம்' என்றும், ரத்து செய்ய 'இல்லை' என்றும் சொல்லுங்கள்.",
        amount: "தயவுசெய்து சரியான தொகையை ரூபாயில் சொல்லுங்கள்."
      },
      'te-IN': {
        truckNo: "క్షమించండి, ఆ ట్రక్ నాకు కనిపించలేదు. దయచేసి ట్రక్ నంబర్ మళ్లీ చెప్పండి.",
        driverName: "క్షమించండి, ఆ డ్రైవర్ కనిపించలేదు. దయచేసి డ్రైవర్ పేరు మళ్లీ చెప్పండి.",
        startingKM: "నాకు సరైన సంఖ్య రాలేదు. దయచేసి ప్రారంభ కిలోమీటర్లను మళ్లీ చెప్పండి.",
        officeName: "క్షమించండి, ఆ ఆఫీస్ బ్రాంచ్ కనిపించలేదు. దయచేసి మళ్లీ చెప్పండి.",
        confirm: "నిర్ధారించడానికి 'అవును' అని చెప్పండి, లేదా రద్దు చేయడానికి 'వద్దు' అని చెప్పండి.",
        amount: "దయచేసి సరైన ఖర్చు మొత్తాన్ని రూపాయలలో చెప్పండి."
      },
      'kn-IN': {
        truckNo: "ಕ್ಷಮಿಸಿ, ಆ ಟ್ರಕ್ ನನಗೆ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಟ್ರಕ್ ಸಂಖ್ಯೆಯನ್ನು ಮತ್ತೊಮ್ಮೆ ತಿಳಿಸಿ.",
        driverName: "ಕ್ಷಮಿಸಿ, ಆ ಚಾಲಕ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಚಾಲಕನ ಹೆಸರನ್ನು ಮತ್ತೊಮ್ಮೆ ತಿಳಿಸಿ.",
        startingKM: "ನಮಗೆ ಸರಿಯಾದ ಸಂಖ್ಯೆ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರಾರಂಭದ ಕಿಲೋಮೀಟರ್ ಅನ್ನು ಮತ್ತೊಮ್ಮೆ ತಿಳಿಸಿ.",
        officeName: "ಕ್ಷಮಿಸಿ, ಆ ಕಚೇರಿ ಶಾಖೆ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ತಿಳಿಸಿ.",
        confirm: "ಖಚಿತಪಡಿಸಲು 'ಹೌದು' ಎಂದು ಹೇಳಿ, ಅಥವಾ ರದ್ದುಗೊಳಿಸಲು 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ.",
        amount: "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಮೊತ್ತವನ್ನು ರೂಪಾಯಿಗಳಲ್ಲಿ ತಿಳಿಸಿ."
      },
      'mr-IN': {
        truckNo: "क्षमस्व, मला ती ट्रक सापडली नाही. कृपया ट्रक नंबर पुन्हा सांगा.",
        driverName: "क्षमस्व, मला तो ड्रायव्हर सापडला नाही. कृपया ड्रायव्हरचे नाव पुन्हा सांगा.",
        startingKM: "मला वैध संख्या सापडली नाही. कृपया सुरुवातीचे किलोमीटर पुन्हा सांगा.",
        officeName: "क्षमस्व, मला ती ऑफिस ब्रँच सापडली नाही. कृपया पुन्हा सांगा.",
        confirm: "पुष्टी करण्यासाठी 'होय' म्हणा, किंवा रद्द करण्यासाठी 'नाही' म्हणा.",
        amount: "कृपया रुपयांमध्ये वैध रक्कम सांगा."
      }
    };
    return errors[langCode]?.[key] || defaultError;
  };

  // Initialize Speech Recognition
  createEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = voiceLang; // Use user default language

      rec.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript();
          } else {
            interimTranscript += event.results[i][0].transcript();
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Silent timeout - don't show noisy error banner, just stop listening
        } else {
          setRecognitionError(event.error);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef = rec;
    } else {
      setRecognitionError('Speech recognition not supported in this browser.');
    }

    // Greet user on load
    if (isOpen) {
      greetUser();
    }

    return () => {
      stopVoiceAll();
    };
  });

  // Scroll to bottom of chat
  createEffect(() => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
  });

  function speakText(text: string, callback?: () => void) {
    if (isMuted()) {
      if (callback) callback();
      return;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
    }
    setIsSpeaking(true);

    if (typeof window !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Pick a natural voice for that language if possible
      const voices = window.speechSynthesis?.getVoices() || [];
      const matchVoice = voices.find(v => v.lang.includes(voiceLang) || v.lang.includes(voiceLang.split('-')[0]));
      if (matchVoice) {
        utterance.voice = matchVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        if (callback) callback();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        setIsSpeaking(false);
        if (callback) callback();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback if SpeechSynthesis is not supported
      setIsSpeaking(false);
      if (callback) callback();
    }
  }

  function startListening() {
    if (isSpeaking()) return;
    if (recognitionRef) {
      try {
        recognitionRef.start();
      } catch (e) {
        // Recognition might already be running
      }
    }
  }

  function stopListening() {
    if (recognitionRef) {
      recognitionRef.stop();
    }
    setIsListening(false);
  }

  function stopVoiceAll() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef) {
      recognitionRef.abort();
    }
    setIsSpeaking(false);
    setIsListening(false);
  }

  function addMessage(sender: 'assistant' | 'user', text: string, status?: 'success' | 'error' | 'neutral') {
    setMessages(prev => [...prev, { sender, text, timestamp: new Date(), status }]);
  }

  function greetUser() {
    setMessages([]);
    setActiveFlow(null);
    setCurrentStepIdx(-1);
    setFormData({});
    setTranscript('');
    
    const greeting = t.greeting;
    addMessage('assistant', greeting);
    speakText(greeting, () => {
      startListening();
    });
  };

  // Define Flows dynamically
  const flows: Record<'trip' | 'expense', Step[]> = {
    trip: [
      {
        key: 'truckNo',
        question: localizedQuestion('truckNo', "Which truck is for this trip?"),
        type: 'choice',
        getOptions: () => trucks.map(t => t.truckNo),
        validateAndParse: (input) => {
          const match = matchClosestOption(input, trucks.map(t => t.truckNo), 'truck');
          if (match) {
            return { valid: true, value: match };
          }
          return { valid: false, error: localizedError('truckNo', "Sorry, I couldn't find that truck. Please tell me the truck number again.") };
        }
      },
      {
        key: 'driverName',
        question: localizedQuestion('driverName', "Who is the driver for this trip?"),
        type: 'choice',
        getOptions: () => drivers.map(d => d.driverName),
        validateAndParse: (input) => {
          const match = matchClosestOption(input, drivers.map(d => d.driverName), 'driver');
          if (match) {
            return { valid: true, value: match };
          }
          return { valid: false, error: localizedError('driverName', "Sorry, I couldn't find that driver in the registry. Please tell me the driver's name again.") };
        }
      },
      {
        key: 'startingKM',
        question: localizedQuestion('startingKM', "What is the starting odometer KM?"),
        type: 'number',
        validateAndParse: (input) => {
          const parsed = parseSpokenNumber(input);
          if (parsed !== null && parsed >= 0) {
            return { valid: true, value: parsed };
          }
          return { valid: false, error: localizedError('startingKM', "I didn't get a valid number. Please tell me the starting KM again.") };
        }
      },
      {
        key: 'routeFrom',
        question: localizedQuestion('routeFrom', "Where is the cargo being loaded from?"),
        type: 'choice',
        getOptions: () => indianCities,
        validateAndParse: (input) => {
          const match = matchClosestOption(input, indianCities, 'city');
          if (match) {
            return { valid: true, value: match };
          }
          const words = input.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          return { valid: true, value: words.join(' ') };
        }
      },
      {
        key: 'routeTo',
        question: localizedQuestion('routeTo', "Where is the cargo going?"),
        type: 'choice',
        getOptions: () => indianCities,
        validateAndParse: (input) => {
          const match = matchClosestOption(input, indianCities, 'city');
          if (match) {
            return { valid: true, value: match };
          }
          const words = input.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          return { valid: true, value: words.join(' ') };
        }
      },
      {
        key: 'income',
        question: localizedQuestion('income', "What is the cargo rent income in rupees?"),
        type: 'number',
        validateAndParse: (input) => {
          const parsed = parseSpokenNumber(input);
          if (parsed !== null && parsed >= 0) {
            return { valid: true, value: parsed };
          }
          return { valid: false, error: localizedError('income', "I didn't get a valid income. Please say the cargo rent income again.") };
        }
      },
      {
        key: 'officeName',
        question: localizedQuestion('officeName', "Which office branch managed this load?"),
        type: 'choice',
        getOptions: () => offices.map(o => o.officeName),
        validateAndParse: (input) => {
          const match = matchClosestOption(input, offices.map(o => o.officeName), 'office');
          if (match) {
            return { valid: true, value: match };
          }
          return { valid: false, error: localizedError('officeName', "Sorry, I couldn't find that office. Which branch office is this?") };
        }
      },
      {
        key: 'notes',
        question: localizedQuestion('notes', "Do you have any notes for this trip? Say 'skip' if none."),
        type: 'text',
        validateAndParse: (input) => {
          const normalized = input.toLowerCase().trim();
          const skipWords = [
            'skip', 'no', 'none', 'no notes',
            'रद्द', 'छोड़ें', 'छोड़ें', 'नहीं',
            'இல்லை', 'ஒன்றுமில்லை', 'விட்டுவிடு',
            'వద్దు', 'ఏమీ లేదు',
            'ಇಲ್ಲ', 'ಏನೂ ಇಲ್ಲ', 'ಬಿಟ್ಟುಬಿಡು',
            'नको', 'काही नाही'
          ];
          if (skipWords.some(w => normalized.includes(w) || normalized === w)) {
            return { valid: true, value: '' };
          }
          return { valid: true, value: input.trim() };
        }
      },
      {
        key: 'confirm',
        question: localizedQuestion('confirm', "Summary check. Say 'save' to confirm this trip, or 'cancel' to exit."),
        type: 'confirm',
        validateAndParse: (input) => {
          const val = parseConfirmInput(input);
          if (val === 'save') return { valid: true, value: 'save' };
          if (val === 'cancel') return { valid: true, value: 'cancel' };
          return { valid: false, error: localizedError('confirm', "Would you like to save this trip? Say 'save' to confirm, or 'cancel' to abort.") };
        }
      }
    ],
    expense: [
      {
        key: 'truckNo',
        question: localizedQuestion('truckNo_expense', "Which truck is this expense for?"),
        type: 'choice',
        getOptions: () => trucks.map(t => t.truckNo),
        validateAndParse: (input) => {
          const match = matchClosestOption(input, trucks.map(t => t.truckNo), 'truck');
          if (match) {
            return { valid: true, value: match };
          }
          return { valid: false, error: localizedError('truckNo', "Sorry, I couldn't find that truck. Please tell me the truck number again.") };
        }
      },
      {
        key: 'expenseType',
        question: localizedQuestion('expenseType', "What type of expense is this? For example: Fuel, Driver Food, Maintenance, Toll."),
        type: 'text',
        validateAndParse: (input) => {
          const types = ["Fuel", "Driver Food", "Maintenance", "Toll", "RTO", "Tyre", "AdBlue", "Other"];
          const matched = matchClosestOption(input, types);
          if (matched) return { valid: true, value: matched };
          const cap = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
          return { valid: true, value: cap.trim() };
        }
      },
      {
        key: 'amount',
        question: localizedQuestion('amount', "What is the expense amount in rupees?"),
        type: 'number',
        validateAndParse: (input) => {
          const parsed = parseSpokenNumber(input);
          if (parsed !== null && parsed > 0) {
            return { valid: true, value: parsed };
          }
          return { valid: false, error: localizedError('amount', "Please tell me a valid expense amount in rupees.") };
        }
      },
      {
        key: 'paymentMode',
        question: localizedQuestion('paymentMode', "Which ledger account did you use? For example: Cash, Bank, or driver name."),
        type: 'choice',
        getOptions: () => [...accounts.map(a => a.accountName), ...drivers.map(d => d.driverName)],
        validateAndParse: (input) => {
          const options = [...accounts.map(a => a.accountName), ...drivers.map(d => d.driverName)];
          const match = matchClosestOption(input, options);
          if (match) {
            return { valid: true, value: match };
          }
          return { valid: true, value: input.trim() };
        }
      },
      {
        key: 'confirm',
        question: localizedQuestion('confirm_expense', "Summary check. Say 'save' to confirm this expense voucher, or 'cancel' to exit."),
        type: 'confirm',
        validateAndParse: (input) => {
          const val = parseConfirmInput(input);
          if (val === 'save') return { valid: true, value: 'save' };
          if (val === 'cancel') return { valid: true, value: 'cancel' };
          return { valid: false, error: localizedError('confirm', "Would you like to save this expense? Say 'save' to confirm, or 'cancel' to abort.") };
        }
      }
    ]
  };

  const handleInputTextSubmit = (e?: Event) => {
    if (e) e.preventDefault();
    if (!textInput().trim()) return;

    const userInput = textInput().trim();
    setTextInput('');
    processUserInput(userInput);
  };

  // Watch for spoken transcripts
  createEffect(() => {
    if (transcript() && !isSpeaking() && !isListening()) {
      const finalInput = transcript();
      setTranscript('');
      processUserInput(finalInput);
    }
  });

  // Restart recognition if listening was aborted prematurely while speaking is false
  createEffect(() => {
    if (!isListening() && !isSpeaking() && activeFlow() !== null && currentStepIdx() >= 0) {
      const t = setTimeout(() => {
        if (!isListening() && !isSpeaking()) {
          startListening();
        }
      }, 500);
      return () => clearTimeout(t);
    }
  });

  const processUserInput = (input: string) => {
    addMessage('user', input);

    const normalizedInput = input.toLowerCase().trim();
    if (
      normalizedInput === 'cancel' || 
      normalizedInput === 'exit' || 
      normalizedInput === 'close' || 
      normalizedInput === 'रद्द' || 
      normalizedInput === 'बंद' || 
      normalizedInput === 'बाहर'
    ) {
      addMessage('assistant', t.cancelText, 'neutral');
      speakText(t.cancelText, () => {
        onClose();
      });
      return;
    }

    if (normalizedInput === 'restart' || normalizedInput === 'reset' || normalizedInput === 'start over' || normalizedInput === 'फिर से') {
      greetUser();
      return;
    }

    if (normalizedInput === 'repeat' || normalizedInput === 'say again' || normalizedInput === 'what' || normalizedInput === 'दोहराएं' || normalizedInput === 'दोहराओ') {
      if (activeFlow() && currentStepIdx() >= 0) {
        const step = flows[activeFlow()][currentStepIdx()];
        speakText(step.question, () => {
          startListening();
        });
      } else {
        greetUser();
      }
      return;
    }

    // 3. Flow Selection state
    if (activeFlow() === null) {
      const tripKeywords = [
        'trip', 'journey', 'travel',
        'यात्रा', 'ट्रिप', 'सफर',
        'பயணம்', 'பயணத்தை', 'உருவாக்கு',
        'ప్రయాణం', 'ప్రయాణాన్ని', 'ట్రిప్',
        'ಪ್ರಯಾಣ', 'ಪ್ರಯಾಣವನ್ನು', 'ಟ್ರಿಪ್',
        'प्रवास', 'ट्रिप'
      ];

      const expenseKeywords = [
        'expense', 'voucher', 'bill', 'payment',
        'खर्च', 'बिल', 'वाउचर',
        'செலவு', 'செலவை', 'பற்று',
        'ఖర్చు', 'ఖర్చును', 'ఖర్చులు',
        'ಖರ್ಚು', 'ಖರ್ಚನ್ನು',
        'खर्च', 'खर्चाची'
      ];

      if (tripKeywords.some(kw => normalizedInput.includes(kw))) {
        setActiveFlow('trip');
        setCurrentStepIdx(0);
        const firstStep = flows.trip[0];
        addMessage('assistant', `${t.tripHeader}${firstStep.question}`);
        speakText(`${t.tripHeader}${firstStep.question}`, () => {
          startListening();
        });
      } else if (expenseKeywords.some(kw => normalizedInput.includes(kw))) {
        setActiveFlow('expense');
        setCurrentStepIdx(0);
        const firstStep = flows.expense[0];
        addMessage('assistant', `${t.expenseHeader}${firstStep.question}`);
        speakText(`${t.expenseHeader}${firstStep.question}`, () => {
          startListening();
        });
      } else {
        addMessage('assistant', t.fallbackMsg, 'error');
        speakText(t.fallbackMsg, () => {
          startListening();
        });
      }
      return;
    }

    // 4. Processing flow steps
    const flowSteps = flows[activeFlow()];
    const currentStep = flowSteps[currentStepIdx()];

    const result = currentStep.validateAndParse(input);

    if (!result.valid) {
      const errMsg = result.error || "Invalid response. Please try again.";
      addMessage('assistant', errMsg, 'error');
      speakText(errMsg, () => {
        startListening();
      });
      return;
    }

    const updatedData = { ...formData(), [currentStep.key]: result.value };
    setFormData(updatedData);

    if (currentStep.type === 'confirm') {
      if (result.value === 'save') {
        saveDocument(updatedData);
      } else {
        addMessage('assistant', t.abortText, 'neutral');
        speakText(t.abortText, () => {
          greetUser();
        });
      }
      return;
    }

    // Advance to next step
    const nextIdx = currentStepIdx() + 1;
    setCurrentStepIdx(nextIdx);
    const nextStep = flowSteps[nextIdx];

    let spokenQuestion = nextStep.question;
    if (nextStep.type === 'confirm') {
      if (activeFlow() === 'trip') {
        if (langCode === 'hi-IN') {
          spokenQuestion = `विवरण जाँचें: मैंने ट्रक ${updatedData.truckNo}, ड्राइवर ${updatedData.driverName}, शुरुआत ${updatedData.startingKM} किलोमीटर, रूट ${updatedData.routeFrom} से ${updatedData.routeTo} और किराया ${updatedData.income} रुपये की यात्रा तैयार की है। सहेजने के लिए 'हाँ' कहें, या रद्द करने के लिए 'नहीं' कहें।`;
        } else if (langCode === 'ta-IN') {
          spokenQuestion = `மறுபரிசீலனை: லாரி ${updatedData.truckNo}, ஓட்டுநர் ${updatedData.driverName}, ஆரம்ப கிலோமீட்டர் ${updatedData.startingKM}, ${updatedData.routeFrom} முதல் ${updatedData.routeTo} வரையிலான பாதை மற்றும் வாடகை ரூபாய் ${updatedData.income} கொண்ட ஒரு பயணத்தை நான் தயार செய்துள்ளேன். சேமிக்க 'ஆம்' என்றும், வெளியேற 'இல்லை' என்றும் சொல்லுங்கள்.`;
        } else if (langCode === 'te-IN') {
          spokenQuestion = `సారాంశం: నేను ట్రక్ ${updatedData.truckNo}, డ్రైవర్ ${updatedData.driverName}, ప్రారంభం ${updatedData.startingKM} కిలోమీటర్లు, ${updatedData.routeFrom} నుండి ${updatedData.routeTo} మార్గం మరియు అద్దె రూపాయలు ${updatedData.income} తో ప్రయాణాన్ని సిద్ధం చేసాను. సేవ్ చేయడానికి 'అవును' అని చెప్పండి, లేదా నిష్క్రమించడానికి 'వద్దు' అని చెప్పండి.`;
        } else if (langCode === 'kn-IN') {
          spokenQuestion = `ಸಾರಾಂಶ: ನಾನು ಟ್ರಕ್ ${updatedData.truckNo}, ಚಾಲಕ ${updatedData.driverName}, ಪ್ರಾರಂಭದ ಓಡೋಮೀಟರ್ ${updatedData.startingKM} ಕಿಲೋಮೀಟರ್, ${updatedData.routeFrom} ರಿಂದ ${updatedData.routeTo} ಮಾರ್ಗ ಮತ್ತು ಬಾಡಿಗೆ ರೂಪಾಯಿ ${updatedData.income} ನೊಂದಿಗೆ ಪ್ರಯಾಣವನ್ನು ಸಿದ್ಧಪಡಿಸಿದ್ದೇನೆ. ಉಳಿಸಲು 'ಹೌದು' ಎಂದು ಹೇಳಿ, ಅಥವಾ ಹೊರಹೋಗಲು 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ.`;
        } else if (langCode === 'mr-IN') {
          spokenQuestion = `विवरण तपासा: मी ट्रक ${updatedData.truckNo}, ड्रायव्हर ${updatedData.driverName}, सुरुवात ${updatedData.startingKM} किलोमीटर, मार्ग ${updatedData.routeFrom} ते ${updatedData.routeTo} आणि भाडे ${updatedData.income} रुपये असलेला प्रवास तयार केला आहे. जतन करण्यासाठी 'होय' म्हणा, किंवा रद्द करण्यासाठी 'नाही' म्हणा.`;
        } else {
          spokenQuestion = `Summary: I have prepared a trip for truck ${updatedData.truckNo}, driven by ${updatedData.driverName}, starting at ${updatedData.startingKM} KM, going from ${updatedData.routeFrom} to ${updatedData.routeTo} with rent of ${updatedData.income} rupees. Say 'save' to confirm, or 'cancel' to exit.`;
        }
      } else {
        if (langCode === 'hi-IN') {
          spokenQuestion = `विवरण जाँचें: मैंने ट्रक ${updatedData.truckNo} के लिए ${updatedData.amount} रुपये का ${updatedData.expenseType} खर्च वाउचर तैयार किया है जिसका भुगतान ${updatedData.paymentMode} द्वारा किया गया है। सहेजने के लिए 'हाँ' कहें, या रद्द करने के लिए 'नहीं' कहें।`;
        } else if (langCode === 'ta-IN') {
          spokenQuestion = `மறுபரிசீலனை: லாரி ${updatedData.truckNo} க்காக ${updatedData.paymentMode} மூலம் செலுத்தப்பட்ட ரூபாய் ${updatedData.amount} க்கான ${updatedData.expenseType} செலவு வவுச்சரை நான் தயார் செய்துள்ளேன். சேமிக்க 'ஆம்' என்றும், வெளியேற 'இல்லை' என்றும் சொல்லுங்கள்.`;
        } else if (langCode === 'te-IN') {
          spokenQuestion = `సారాంశం: నేను ట్రక్ ${updatedData.truckNo} కొరకు ${updatedData.paymentMode} ద్వారా చెల్లించిన రూపాయలు ${updatedData.amount} తో ${updatedData.expenseType} ఖర్చు వోచర్‌ను సిద్ధం చేసాను. సేవ్ చేయడానికి 'అవును' అని చెప్పండి, లేదా నిష్క్రమించడానికి 'వద్దు' అని చెప్పండి.`;
        } else if (langCode === 'kn-IN') {
          spokenQuestion = `ಸಾರಾಂಶ: ನಾನು ಟ್ರಕ್ ${updatedData.truckNo} ಗಾಗಿ ${updatedData.paymentMode} ಮೂಲಕ ಪಾವತಿಸಿದ ರೂಪಾಯಿ ${updatedData.amount} ನೊಂದಿಗೆ ${updatedData.expenseType} ಖರ್ಚು ವೋಚರ್ ಅನ್ನು ಸಿದ್ಧಪಡಿಸಿದ್ದೇನೆ. ಉಳಿಸಲು 'ಹೌದು' ಎಂದು ಹೇಳಿ, ಅಥವಾ ಹೊರಹೋಗಲು 'ಇಲ್ಲ' ಎಂದು ಹೇಳಿ.`;
        } else if (langCode === 'mr-IN') {
          spokenQuestion = `विवरण तपासा: मी ट्रक ${updatedData.truckNo} साठी ${updatedData.paymentMode} द्वारे दिलेला रुपये ${updatedData.amount} चा ${updatedData.expenseType} खर्च व्हाउचर तयार केला आहे. जतन करण्यासाठी 'होय' म्हणा, किंवा रद्द करण्यासाठी 'नाही' म्हणा.`;
        } else {
          spokenQuestion = `Summary: I have prepared an expense of ${updatedData.amount} rupees for truck ${updatedData.truckNo} for ${updatedData.expenseType} paid via ${updatedData.paymentMode}. Say 'save' to confirm, or 'cancel' to exit.`;
        }
      }
    }

    addMessage('assistant', spokenQuestion);
    speakText(spokenQuestion, () => {
      startListening();
    });
  };

  const saveDocument = (data: Record<string, any>) => {
    if (activeFlow() === 'trip') {
      const currentYear = new Date().getFullYear();
      let lastSeq = 0;
      existingTripNos.forEach(v => {
        const match = v.match(/TRIP-(\d+)-(\d+)/);
        if (match && parseInt(match[1]) === currentYear) {
          const seq = parseInt(match[2]);
          if (seq > lastSeq) lastSeq = seq;
        }
      });
      const newSeq = String(lastSeq + 1).padStart(4, '0');
      const tripNo = `TRIP-${currentYear}-${newSeq}`;

      const tripObj: Omit<TripEntry, 'id'> = {
        tripNo,
        truckNo: data.truckNo,
        startDate: new Date().toISOString().substring(0, 10),
        endDate: new Date().toISOString().substring(0, 10),
        driverName: data.driverName,
        startingKM: data.startingKM,
        endingKM: data.startingKM,
        status: 'Pending',
        notes: data.notes || undefined,
        payments: [],
        advances: [],
        subTrips: [
          {
            id: 'sub_voice_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            loadingDate: new Date().toISOString().substring(0, 10),
            officeName: data.officeName,
            routeFrom: data.routeFrom,
            routeTo: data.routeTo,
            income: data.income,
            loadingExpense: 0,
            unloadingExpense: 0,
            driverWages: 0,
            loadingPaidByDriver: true,
            unloadingPaidByDriver: true,
            brokeragePaidByDriver: true,
            startingKM: data.startingKM,
            endingKM: data.startingKM
          }
        ]
      };

      onSubmitTrip(tripObj);
      
      const textMsg = t.successTrip.replace('{code}', tripNo);
      const voiceMsg = t.successTripVoice.replace('{code}', tripNo.replace(/-/g, ' '));
      addMessage('assistant', textMsg, 'success');
      speakText(voiceMsg, () => {
        onClose();
      });
    } else if (activeFlow() === 'expense') {
      const expObj: Omit<ExpenseEntry, 'id'> = {
        truckNo: data.truckNo,
        expenseType: data.expenseType,
        amount: data.amount,
        paymentMode: data.paymentMode,
        date: new Date().toISOString().substring(0, 10),
        status: 'Approved',
        shopName: 'Voice Assistant Voucher',
        accountType: 'Account'
      };

      onSubmitExpense(expObj);
      
      const textMsg = t.successExpense.replace('{amount}', data.amount.toString());
      const voiceMsg = t.successExpenseVoice.replace('{amount}', data.amount.toString());
      addMessage('assistant', textMsg, 'success');
      speakText(voiceMsg, () => {
        onClose();
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      class="fixed bottom-6 right-6 w-96 max-h-[520px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-up font-sans"
      id="voice-assistant-drawer"
    >
      {/* Header */}
      <div class="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center select-none">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-amber-300 animate-pulse" />
          <span class="font-bold text-xs uppercase tracking-wider">Antigravity Voice Pilot</span>
        </div>
        
        <div class="flex items-center gap-1.5">
          {/* Mute button */}
          <button 
            onClick={() => {
              const nextMuted = !isMuted();
              setIsMuted(nextMuted);
              if (nextMuted && typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
            class="p-1 hover:bg-white/20 rounded transition cursor-pointer"
            title={isMuted() ? "Unmute Assistant" : "Mute Assistant"}
          >
            {isMuted() ? <VolumeX class="w-4 h-4" /> : <Volume2 class="w-4 h-4" />}
          </button>

          {/* Reset button */}
          <button 
            onClick={greetUser}
            class="p-1 hover:bg-white/20 rounded transition cursor-pointer"
            title="Restart dialogue"
          >
            <RefreshCw class="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button 
            onClick={() => {
              stopVoiceAll();
              onClose();
            }}
            class="p-1 hover:bg-white/20 rounded transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div class="flex-1 p-4 overflow-y-auto space-y-3 max-h-[360px] min-h-[220px] bg-slate-50/50 dark:bg-slate-950/20">
        {messages().map((m, idx) => (
          <div 
             
            class={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div class={`
              max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-3xs
              ${m.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : m.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-bl-none font-semibold'
                : m.status === 'error' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 rounded-bl-none'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 rounded-bl-none'
              }
            `}>
              {m.text}
            </div>
          </div>
        ))}
        {transcript() && (
          <div class="flex justify-end animate-pulse">
            <div class="max-w-[80%] bg-blue-600/40 text-white border border-blue-500/20 rounded-2xl rounded-br-none px-3 py-2 text-xs italic">
              {transcript()}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Soundwave/Speech Visualizer */}
      <div class="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 h-10 select-none">
        <div class="flex items-center gap-2">
          {isListening() ? (
            <div class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ 'animation-delay': '0ms' }} />
              <span class="w-1.5 h-3 bg-blue-600 rounded-full animate-bounce" style={{ 'animation-delay': '150ms' }} />
              <span class="w-1.5 h-2 bg-blue-500 rounded-full animate-bounce" style={{ 'animation-delay': '300ms' }} />
              <span class="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ 'animation-delay': '450ms' }} />
              <span class="text-[10px] text-blue-600 font-bold dark:text-blue-400 ml-1.5">Listening...</span>
            </div>
          ) : isSpeaking() ? (
            <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">Speaking...</span>
          ) : (
            <span class="text-[10px] text-slate-400 font-medium">Click microphone to reply</span>
          )}
        </div>

        {/* Action micro button */}
        <button
          onClick={() => {
            if (isListening()) {
              stopListening();
            } else {
              startListening();
            }
          }}
          class={`
            p-1.5 rounded-full transition cursor-pointer
            ${isListening() 
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm ring-4 ring-red-100 dark:ring-red-950/40' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
            }
          `}
          title={isListening() ? "Pause microphone" : "Activate microphone"}
        >
          {isListening() ? <MicOff class="w-3.5 h-3.5" /> : <Mic class="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Manual Input Fallback Bar */}
      <form 
        onSubmit={handleInputTextSubmit} 
        class="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-1.5 items-center"
      >
        <input 
          type="text" 
          value={textInput()}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={isSpeaking() ? "Speaking..." : "Type response here..."}
          disabled={isSpeaking()}
          class="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium disabled:opacity-40"
        />
        <button 
          type="submit"
          disabled={isSpeaking() || !textInput().trim()}
          class="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 rounded-lg transition cursor-pointer"
        >
          <Send class="w-3.5 h-3.5" />
        </button>
      </form>
      
      {recognitionError() && (
        <div class="absolute top-10 left-2 right-2 p-2 bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-lg text-[10px] leading-tight flex items-start gap-1.5 shadow-md">
          <AlertCircle class="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span class="font-bold">Mic Error:</span> {recognitionError()}
          </div>
          <button onClick={() => setRecognitionError(null)} class="ml-auto font-bold text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}
    </div>
  );
}
