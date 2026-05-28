import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceAssistant from './VoiceAssistant';
import { Truck, Driver, Office, Account } from '../types';

describe('VoiceAssistant Component Regional Language Tests', () => {
  const mockTrucks: Truck[] = [];
  const mockDrivers: Driver[] = [];
  const mockOffices: Office[] = [];
  const mockAccounts: Account[] = [];

  it('should render and greet in English when voiceLang is en-IN', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="en-IN"
      />
    );

    // English greeting
    expect(screen.getByText(/Hello! I am your Antigravity Assistant/i)).toBeInTheDocument();
  });

  it('should render and greet in Tamil when voiceLang is ta-IN', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="ta-IN"
      />
    );

    // Tamil greeting
    expect(screen.getByText(/வணக்கம்! நான் உங்கள் ஆண்டிகிராவிட்டி உதவியாளர்/i)).toBeInTheDocument();
  });

  it('should render and greet in Telugu when voiceLang is te-IN', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="te-IN"
      />
    );

    // Telugu greeting
    expect(screen.getByText(/నమస్కారం! నేను మీ యాంటీగ్రావిటీ సహాయకుడిని/i)).toBeInTheDocument();
  });

  it('should render and greet in Kannada when voiceLang is kn-IN', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="kn-IN"
      />
    );

    // Kannada greeting
    expect(screen.getByText(/ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಆಂಟಿಗ್ರಾವಿಟಿ ಸಹಾಯಕ/i)).toBeInTheDocument();
  });

  it('should render and greet in Marathi when voiceLang is mr-IN', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="mr-IN"
      />
    );

    // Marathi greeting
    expect(screen.getByText(/नमस्कार! मी आपला अँटीग्रॅव्हिटी असिस्टंट आहे/i)).toBeInTheDocument();
  });

  it('should start trip flow when Tamil keyword "பயணம்" is submitted via text input', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="ta-IN"
      />
    );

    const input = screen.getByPlaceholderText(/Type response here/i);
    fireEvent.change(input, { target: { value: 'பயணம்' } });

    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    // Expect trip flow header in Tamil
    expect(screen.getByText(/பயணப் பதிவேட்டைத் தொடங்குகிறேன்/i)).toBeInTheDocument();
  });

  it('should start expense flow when Tamil keyword "செலவு" is submitted via text input', () => {
    render(
      <VoiceAssistant
        isOpen={true}
        onClose={() => {}}
        trucks={mockTrucks}
        drivers={mockDrivers}
        offices={mockOffices}
        accounts={mockAccounts}
        existingTripNos={[]}
        onSubmitTrip={() => {}}
        onSubmitExpense={() => {}}
        voiceLang="ta-IN"
      />
    );

    const input = screen.getByPlaceholderText(/Type response here/i);
    fireEvent.change(input, { target: { value: 'செலவு' } });

    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    // Expect expense flow header in Tamil
    expect(screen.getByText(/செலவு வவுச்சரைத் தொடங்குகிறேன்/i)).toBeInTheDocument();
  });
});
