import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { Router, Route } from '@solidjs/router';
import LandingPage from './LandingPage';

describe('LandingPage Component Tests', () => {
  it('should render the hero section with exact LorryGuru branding and live active monitor', () => {
    const mockEnterConsole = vi.fn();
    render(() => (
      <Router>
        <Route path="*" component={() => <LandingPage onEnterConsole={mockEnterConsole} />} />
      </Router>
    ));

    // Header Logo & Brand
    expect(screen.getByAltText('LorryGuru Logo')).toBeInTheDocument();
    expect(screen.getByText('Logistics Management Hub')).toBeInTheDocument();
    expect(screen.getByText('Drive Your Business')).toBeInTheDocument();
    expect(screen.getByText('Forward')).toBeInTheDocument();

    // Live Active Monitor
    expect(screen.getByText('Live Active Monitor')).toBeInTheDocument();
    expect(screen.getByText('98.4%')).toBeInTheDocument();
    expect(screen.getByText('99.1%')).toBeInTheDocument();
    expect(screen.getByText('Segment Route #092')).toBeInTheDocument();
    expect(screen.getByText('Chennai Hub')).toBeInTheDocument();
    expect(screen.getByText('Mumbai Branch')).toBeInTheDocument();

    // 4 Feature Cards
    expect(screen.getByText('Active Dispatch & SubTrip Logs')).toBeInTheDocument();
    expect(screen.getByText('Driver Settlement Ledger')).toBeInTheDocument();
    expect(screen.getByText('Multi-Axle Tyres Master')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp & Double 2FA Security')).toBeInTheDocument();
  });

  it('should trigger onEnterConsole when Access Console or Launch App Console is clicked', () => {
    const mockEnterConsole = vi.fn();
    render(() => (
      <Router>
        <Route path="*" component={() => <LandingPage onEnterConsole={mockEnterConsole} />} />
      </Router>
    ));

    const launchBtn = screen.getByRole('button', { name: /Launch App Console/i });
    fireEvent.click(launchBtn);
    expect(mockEnterConsole).toHaveBeenCalledTimes(1);

    const accessConsoleBtn = screen.getAllByRole('button', { name: /Access Console/i })[0];
    fireEvent.click(accessConsoleBtn);
    expect(mockEnterConsole).toHaveBeenCalledTimes(2);
  });

  it('should switch between Home, Company Profile, About Us, and Contact Us tabs', async () => {
    render(() => (
      <Router>
        <Route path="*" component={() => <LandingPage onEnterConsole={vi.fn()} />} />
      </Router>
    ));

    // Click Company Profile
    const profileTabBtn = screen.getByRole('button', { name: 'Company Profile' });
    fireEvent.click(profileTabBtn);
    expect(screen.getByText('Our Core Platform Services')).toBeInTheDocument();
    expect(screen.getByText('1.2M+')).toBeInTheDocument();
    expect(screen.getByText('50K+')).toBeInTheDocument();

    // Click About Us
    const aboutTabBtn = screen.getByRole('button', { name: 'About Us' });
    fireEvent.click(aboutTabBtn);
    expect(screen.getByText('Our Mission')).toBeInTheDocument();
    expect(screen.getByText('Built for the Field')).toBeInTheDocument();
    expect(screen.getByText('Intuitive Design')).toBeInTheDocument();

    // Click Contact Us
    const contactTabBtn = screen.getByRole('button', { name: 'Contact Us' });
    fireEvent.click(contactTabBtn);
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Get in Touch')).toBeInTheDocument();
    expect(screen.getByText('support@lorryguru.in')).toBeInTheDocument();
  });

  it('should allow submitting contact support tickets', async () => {
    const mockRaiseTicket = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <Router>
        <Route path="*" component={() => <LandingPage onEnterConsole={vi.fn()} onRaisePublicTicket={mockRaiseTicket} />} />
      </Router>
    ));

    // Switch to Contact Us
    fireEvent.click(screen.getByRole('button', { name: 'Contact Us' }));

    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'Kadhir Transport' } });
    fireEvent.change(screen.getByPlaceholderText('john@company.com'), { target: { value: 'kadhir@lorryguru.in' } });
    fireEvent.change(screen.getByPlaceholderText('Enter mobile number'), { target: { value: '9489223134' } });
    fireEvent.change(screen.getByPlaceholderText('How can we help your operations?'), { target: { value: 'Need assistance setting up branch accounting.' } });

    fireEvent.click(screen.getByRole('button', { name: /Send Message/i }));

    await waitFor(() => {
      expect(mockRaiseTicket).toHaveBeenCalledWith(
        'Kadhir Transport',
        'kadhir@lorryguru.in',
        '+919489223134',
        'General',
        'Need assistance setting up branch accounting.'
      );
      expect(screen.getByText(/Thank you! Your message has been sent successfully/i)).toBeInTheDocument();
    });
  });

  it('should render footer policy navigation links', () => {
    render(() => (
      <Router>
        <Route path="*" component={() => <LandingPage onEnterConsole={vi.fn()} />} />
      </Router>
    ));

    // Verify footer links
    expect(screen.getByRole('button', { name: 'Terms & Conditions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund & Cancellation Policy' })).toBeInTheDocument();
  });
});
