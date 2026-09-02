import { createContext, useContext, createSignal, onMount, onCleanup } from 'solid-js';
import { TripEntry } from '../types';

interface DialogContextType {
  bookingModalOpen: () => boolean;
  setBookingModalOpen: (open: boolean) => void;
  editingTrip: () => TripEntry | null;
  setEditingTrip: (trip: TripEntry | null) => void;
  isVoiceAssistantOpen: () => boolean;
  setIsVoiceAssistantOpen: (open: boolean) => void;
  profileModalOpen: () => boolean;
  setProfileModalOpen: (open: boolean) => void;
  profileActiveTab: () => 'SETTINGS' | 'SUPPORT';
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  profileDropdownOpen: () => boolean;
  setProfileDropdownOpen: (open: boolean) => void;
  showPhoneUpdateModal: () => boolean;
  setShowPhoneUpdateModal: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogManager(props: { children: any }) {
  const [bookingModalOpen, setBookingModalOpen] = createSignal(false);
  const [editingTrip, setEditingTrip] = createSignal<TripEntry | null>(null);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = createSignal(false);
  const [profileModalOpen, setProfileModalOpen] = createSignal(false);
  const [profileActiveTab, setProfileActiveTab] = createSignal<'SETTINGS' | 'SUPPORT'>('SETTINGS');
  const [profileDropdownOpen, setProfileDropdownOpen] = createSignal(false);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = createSignal(false);

  // Listen for Alt+V shortcut to toggle Voice Assistant
  onMount(() => {
    console.log("DialogManager mounted");
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceAssistantOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  const value: DialogContextType = {
    bookingModalOpen,
    setBookingModalOpen,
    editingTrip,
    setEditingTrip,
    isVoiceAssistantOpen,
    setIsVoiceAssistantOpen,
    profileModalOpen,
    setProfileModalOpen,
    profileActiveTab,
    setProfileActiveTab,
    profileDropdownOpen,
    setProfileDropdownOpen,
    showPhoneUpdateModal,
    setShowPhoneUpdateModal
  };

  return (
    <DialogContext.Provider value={value}>
      {props.children}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogs must be used within a DialogManager');
  }
  return context;
}
