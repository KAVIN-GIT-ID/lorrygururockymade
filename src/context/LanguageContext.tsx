import { createContext, useContext, createSignal, createEffect, onMount, JSX } from 'solid-js';
import { storageService } from '../services/storageService';

export type LanguageCode = 'ta' | 'en' | 'hi' | 'te' | 'kn' | 'mr';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' }
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  ta: {
    // Nav & Sidebar
    'nav.dashboard': 'முகப்பு (டேஷ்போர்டு)',
    'nav.trucks': 'லாரிகள் (வண்டிகள்)',
    'nav.drivers': 'ஓட்டுநர்கள் (டிரைவர்கள்)',
    'nav.trips': 'டிரிப் ஏடுகள் (ட்ரிப்ஸ்)',
    'nav.expenses': 'செலவுகள் (வவுச்சர்)',
    'nav.offices': 'அலுவலகங்கள் / கிளைகள்',
    'nav.accounts': 'கணக்கு புத்தகங்கள்',
    'nav.tyres': 'டயர் மேலாண்மை',
    'nav.reports': 'மாதாந்திர தணிக்கை',
    'nav.audit': 'செயல்பாட்டு பதிவுகள்',
    'nav.users': 'பயனர்கள் அணுகல்',
    'nav.console': 'கட்டுப்பாட்டு அறை',

    // Action buttons & Common UI
    'btn.new_trip': 'புதிய டிரிப் பதிவு',
    'btn.new_truck': 'புதிய லாரி சேர்க்க',
    'btn.new_driver': 'புதிய டிரைவர் சேர்க்க',
    'btn.add_expense': 'செலவு பதிவு',
    'btn.save': 'சேமிக்க',
    'btn.cancel': 'ரத்து செய்ய',
    'btn.delete': 'நீக்குக',
    'btn.edit': 'திருத்து',
    'btn.close': 'மூடு',
    'btn.search': 'தேடுக...',
    'btn.export': 'பதிவிறக்கு',
    'btn.import': 'பதிவேற்று',
    'btn.clear_data': 'தரவு அழி',
    'btn.backup': 'காப்புப்பிரதி',
    'btn.restore': 'மீட்டமைக்க',
    'btn.logout': 'வெளியேறு',

    // Dashboard Cards & Terms
    'dash.total_trucks': 'மொத்த லாரிகள்',
    'dash.active_trips': 'நடப்பு டிரிப்புகள்',
    'dash.total_freight': 'மொத்த வாடகை வருவாய்',
    'dash.total_expenses': 'மொத்த செலவுகள்',
    'dash.net_profit': 'நிகர லாபம்',
    'dash.driver_advances': 'டிரைவர் முன்பணம்',
    'dash.pending_approval': 'ஒப்புதல் நிலுவை',

    // Truck Status & Fields
    'truck.datasheet_title': 'லாரிகள் மற்றும் சான்றிதழ் விவரங்கள்',
    'truck.datasheet_sub': 'வண்டிகளின் மைலேஜ், இன்சூரன்ஸ், எஃப்.சி, மற்றும் சான்றிதழ் தகவல்கள்.',
    'truck.registered': 'பதிவு செய்யப்பட்டது',
    'truck.limit': 'வரம்பு',
    'btn.subscribe_add_truck': 'சந்தா செலுத்தி லாரி சேர்க்க',
    'truck.number': 'வண்டி எண்',
    'truck.owner': 'உரிமையாளர் / சப்ளையர்',
    'truck.driver': 'ஒதுக்கப்பட்ட ஓட்டுநர்',
    'truck.status': 'வண்டி நிலை',
    'truck.status.available': 'தயாராக உள்ளது',
    'truck.status.ontrip': 'டிரிப்பில் உள்ளது',
    'truck.status.maintenance': 'பராமரிப்பில் உள்ளது',

    // Compliance Certifications
    'truck.compliance_header': 'சான்றிதழ் காலக்கெடு விவரங்கள்',
    'truck.insurance': 'இன்சூரன்ஸ் (Insurance)',
    'truck.fc': 'எஃப்.சி சான்றிதழ் (FC)',
    'truck.np': 'தேசிய பெர்மிட் (National Permit)',
    'truck.five_year_permit': '5 ஆண்டு பெர்மிட்',
    'truck.q_tax': 'காலாண்டு வரி (Q-Tax)',
    'truck.green_tax': 'பசுமை வரி (Green Tax)',
    'truck.np_tax': 'தேசிய பெர்மிட் வரி',
    'truck.odo': 'தற்போதைய ஓடோமீட்டர் (KM)',

    // Trip Register & Ledger Fields
    'trip.list_title': 'டிரிப் ஏடுகள் மற்றும் வாடகை விவரங்கள்',
    'trip.list_sub': 'வண்டிகளின் டிரிப் ஏடுகள், பெறப்பட்ட வாடகை, டீசல் செலவுகள் மற்றும் நிகர லாபம்.',
    'trip.id_group': 'டிரிப் எண்',
    'trip.truck_driver': 'லாரி & ஓட்டுநர்',
    'trip.dates': 'டிரிப் தேதிகள்',
    'trip.income': 'மொத்த வாடகை வருவாய்',
    'trip.expenses': 'செலவுகள்',
    'trip.profit': 'நிகர லாபம்',
    'trip.outstanding': 'நிலுவை தொகை',
    'trip.status': 'நிலை',
    'trip.actions': 'செயல்கள்',
    'trip.download_report': 'அறிக்கை பதிவிறக்கு',
    'trip.recover': 'வசூலிக்க வேண்டியவை',

    // Statuses
    'status.pending': 'நிலுவையில்',
    'status.in_progress': 'இயக்கத்தில்',
    'status.completed': 'முடிக்கப்பட்டது',
    'status.settled': 'கணக்கு முடிக்கப்பட்டது',

    // Trip Form Modal & Dynamic Controls
    'trip.form_title_new': 'புதிய டிரிப் பதிவு செய்தல்',
    'trip.form_title_edit': 'டிரிப் விவரங்களை திருத்துதல்',
    'trip.select_truck': 'லாரி தேர்ந்தெடுக்கவும்',
    'trip.select_driver': 'ஓட்டுநர் தேர்ந்தெடுக்கவும்',
    'trip.start_date': 'டிரிப் தொடங்கிய தேதி',
    'trip.end_date': 'டிரிப் முடிந்த தேதி',
    'trip.start_km': 'ஆரம்ப ஓடோமீட்டர் (KM)',
    'trip.end_km': 'முடிவு ஓடோமீட்டர் (KM)',
    'trip.freight_amount': 'வாடகை தொகை (Freight Income)',
    'trip.advance_paid': 'டிரைவர் முன்பணம் (Driver Advance)',
    'trip.loading_charge': 'ஏற்றுக்கூலி / இறக்குக்கூலி',
    'trip.fuel_expense': 'டீசல் செலவு (Fuel Cost)',
    'trip.toll_expense': 'டோல்கேட் செலவு (Toll Gate)',
    'trip.rto_police': 'ஆர்டிஓ / போலீஸ் செலவு (RTO/Police)',
    'trip.driver_batta': 'டிரைவர் படி (Driver Batta)',
    'trip.other_expense': 'இதர செலவுகள் (Other Expenses)',

    // Trip Form Specific Categories & Labels
    'trip.cat1_title': 'பிரிவு 1: முதன்மை டிரிப் விவரங்கள்',
    'trip.cat2_title': 'பிரிவு 2: சுமை சுற்றுவரவு விவரங்கள் & செலவுகள்',
    'trip.cat3_title': 'பிரிவு 3: ஓட்டுநர் முன்பணம் (முழு டிரிப்)',
    'trip.common_expenses_title': 'டீசல், டோல்கேட் & இதர பொது செலவுகள்',
    'trip.code_id': 'டிரிப் எண் / குறியீடு',
    'trip.target_truck': 'தேர்ந்தெடுக்கப்பட்ட லாரி',
    'trip.driver_operator': 'ஓட்டுநர் (டிரைவர்)',
    'trip.status_label': 'டிரிப் இயக்க நிலை',
    'trip.status_pending': 'நிலுவையில் (Pending)',
    'trip.status_in_progress': 'இயக்கத்தில் (In Progress)',
    'trip.status.completed': 'முடிக்கப்பட்டது (Completed)',
    'trip.status_settled': 'கணக்கு முடிக்கப்பட்டது (Settled)',
    'trip.add_cargo_segment': '+ புதிய சுற்றுவரவு சேர்',
    'trip.tbl_seg': '# எண்',
    'trip.tbl_date': 'தேதி',
    'trip.tbl_office': 'அலுவலக கிளை',
    'trip.tbl_route': 'பயண வழி',
    'trip.tbl_income': 'வாடகை வருவாய் (₹)',
    'trip.tbl_payments': 'வரவு தொகை (₹)',
    'trip.tbl_receivable': 'நிலுவை தொகை (₹)',
    'trip.tbl_wages': 'டிரைவர் கூலி (₹)',
    'trip.tbl_driver_spend': 'டிரைவர் செலவு (₹)',
    'trip.tbl_brokerage': 'புரோக்கரேஜ் (₹)',
    'trip.tbl_actions': 'திருத்து / நீக்கு',
    'trip.issue_advance': '+ முன்பணம் வழங்கு',
    'trip.add_fuel': '+ டீசல் பதிவு',
    'trip.fuel_logs': 'டீசல் பதிவுப் பட்டியல்',
    'trip.fastag': 'ஃபாஸ்டேக் டோல்கேட் (Fastag Toll)',
    'trip.adblue': 'ஆட்புளூ செலவு (AdBlue)',
    'trip.general_remarks': 'பொதுவான குறிப்புகள் / நினைவூட்டல்',
    'trip.btn_update_record': 'டிரிப் ஏடு சேமிக்க',
    'trip.btn_cancel_journal': 'ரத்து செய்',

    // Sub-Trip Segment Drawer
    'subtrip.drawer_title_new': 'புதிய சுமை சுற்றுவரவு பதிவு',
    'subtrip.drawer_title_edit': 'சுற்றுவரவு விவரங்களை திருத்து',
    'subtrip.est_receivable': 'எதிர்பார்க்கும் நிலுவை',
    'subtrip.loading_office': 'ஏற்றிய அலுவலகம்',
    'subtrip.route_origin': 'சுமை ஏற்றிய இடம் (Origin)',
    'subtrip.route_dest': 'சுமை இறக்கும் இடம் (Destination)',
    'subtrip.material': 'சரக்கு / பொருள் விவரம்',
    'subtrip.no_of_tons': 'மொத்த டன் (Tons)',
    'subtrip.rate_per_ton': 'டன் வாடகை வீதம் (Rate/Ton)',
    'subtrip.billed_freight': 'மொத்த வாடகை வருவாய் (Freight)',
    'subtrip.driver_wages': 'டிரைவர் கூலி / படி',
    'subtrip.add_leg_expense': '+ சுற்றுவரவு செலவு சேர்',
    'trip.section.vehicle_driver': 'வண்டி மற்றும் ஓட்டுநர் விவரங்கள்',
    'trip.section.subtrips': 'சுற்றுவரவு விவரங்கள் (Sub-Trips)',
    'trip.section.advances_fuel': 'செலுத்தப்பட்ட முன்பணம் & டீசல் செலவுகள்',
    'trip.section.payments': 'வாடகை வசூல் வரவுகள் (Freight Receipts)',
    'trip.section.summary': 'லாப நஷ்ட கணக்கீடு (Summary)',
    'trip.subtrip_add': '+ புதிய சுற்றுவரவு சேர்',
    'trip.advance_add': '+ முன்பணம் பதிவு',
    'trip.fuel_add': '+ டீசல் பதிவு',
    'trip.payment_add': '+ வாடகை வரவு சேர்',

    // Modals - Security & Profile
    'profile.title': 'பயனர் கணக்கு அமைப்புகள்',
    'profile.tab_settings': 'கணக்கு விவரங்கள்',
    'profile.tab_support': 'உதவி மையம் & சீட்டுகள்',
    'profile.sec_2fa_title': 'இரண்டு காரணி பாதுகாப்பு (2FA)',
    'profile.sec_2fa_enable': '2FA பாதுகாப்பு இயக்கு',
    'profile.sec_2fa_disable': '2FA பாதுகாப்பு முடக்கு',
    'profile.mobile_wizard_title': 'அலைபேசி எண் மாற்றம்',
    'profile.kyc_title': 'நிறுவன சான்றிதழ்கள் (KYC)',
    'profile.save_btn': 'விவரங்களை சேமிக்க',

    // Security Modals (2FA & Mobile Wizard)
    '2fa.setup_title': '2FA பாதுகாப்பை இயக்குதல்',
    '2fa.disable_title': '2FA பாதுகாப்பை நீக்குதல்',
    '2fa.scan_qr': 'ஆதண்டி கேட்டர் செயலி மூலம் QR குறியீட்டை ஸ்கேன் செய்க.',
    '2fa.enter_code': '6 இலக்க சரிபார்ப்பு குறியீட்டை உள்ளிடவும்',
    'mobile_wizard.step1': 'தற்போதைய கடவுச்சொல்லை உள்ளிடுக',
    'mobile_wizard.step2': 'புதிய அலைபேசி எண் உள்ளிடுக',
    'mobile_wizard.step3': 'OTP சரிபார்ப்பு குறியீடு',

    // Support Tickets & Billing
    'support.title': 'வாடிக்கையாளர் உதவி மையம்',
    'support.create_ticket': '+ புதிய உதவி கோரிக்கை',
    'support.category_tech': 'தொழில்நுட்ப உதவி',
    'support.category_billing': 'கட்டணம் / சந்தா',
    'support.category_general': 'பொதுவான கேள்வி',
    'support.ticket_subject': 'கோரிக்கையின் தலைப்பு',
    'support.ticket_desc': 'விவரங்கள் குறிப்பிடவும்',
    'support.send_msg': 'செய்தி அனுப்பு',

    // Voice Assistant
    'voice.title': 'குரல் வழி பதிவு உதவியாளர்',
    'voice.listening': 'கேட்கிறது...',
    'voice.processing': 'செயலாக்கப்படுகிறது...',
    'voice.try_saying': 'கூற முயலுங்கள்: "புதிய டிரிப் பதிவு செய்"',

    // Expenses & Vouchers
    'exp.title': 'செலவு கணக்குகள் மற்றும் வவுச்சர்கள்',
    'exp.subtitle': 'டீசல், பராமரிப்பு, டிரைவர் சம்பளம் மற்றும் அலுவலக செலவுகள் பதிவு செய்தல்.',
    'exp.add_btn': 'செலவு பதிவு',
    'exp.type': 'செலவு வகை (Category)',
    'exp.amount': 'தொகை (Amount)',
    'exp.date': 'செலவு செய்யப்பட்ட தேதி',
    'exp.voucher_no': 'வவுச்சர் எண்',
    'exp.paid_to': 'பணம் பெற்றவர்',
    'exp.mode': 'செலவு முறை (Cash/Bank)',
    'exp.type.fuel': 'டீசல் செலவு (Fuel)',
    'exp.type.salary': 'டிரைவர் சம்பளம் (Driver Salary)',
    'exp.type.maintenance': 'வண்டி பராமரிப்பு (Maintenance)',
    'exp.type.toll': 'டோல்கேட் (Toll Gate)',
    'exp.type.rto': 'ஆர்டிஓ / அபராதம் (RTO Fine)',
    'exp.type.emi': 'வண்டி கடன் தவணை (Loan EMI)',

    // Drivers & Fleet Staff
    'driver.title': 'ஓட்டுநர்கள் விபரம் (Driver Master)',
    'driver.subtitle': 'டிரைவர் முகவரி, உரிமம் (License), அலைபேசி மற்றும் முன்பணக் கணக்குகள்.',
    'driver.name': 'டிரைவர் பெயர்',
    'driver.phone': 'அலைபேசி எண்',
    'driver.license': 'ஓட்டுநர் உரிம எண் (License No)',
    'driver.license_expiry': 'உரிம காலாவதி தேதி',
    'driver.salary_type': 'சம்பள முறை',
    'driver.daily_batta': 'தினசரி படி (Batta Rate)',
    'driver.advance_balance': 'முன்பண நிலுவை',

    // Tyre Management
    'tyre.title': 'டயர் மேலாண்மை மற்றும் தணிக்கை',
    'tyre.subtitle': 'லாரி டயர்களின் பயன்பாடு, மைலேஜ், ரீட்ரெடிங் (Retread) மற்றும் சுழற்சி விவரங்கள்.',
    'tyre.serial': 'டயர் சீரியல் எண் (Serial No)',
    'tyre.brand': 'டயர் நிறுவனம் (Brand)',
    'tyre.model': 'டயர் மாடல் / அளவு',
    'tyre.position': 'டயர் பொறுத்தப்பட்ட இடம் (Axle Position)',
    'tyre.status': 'டயர் நிலை',
    'tyre.status.new': 'புதிய டயர் (New)',
    'tyre.status.retread': 'ரீட்ரெட் செய்யப்பட்டது (Retreaded)',
    'tyre.status.scrapped': 'கழற்றப்பட்டது (Scrapped)',

    // Monthly Auditing & Reports
    'report.title': 'மாதாந்திர லாப நஷ்ட அறிக்கை',
    'report.subtitle': 'ஒவ்வொரு மாதத்தின் மொத்த வாடகை வருவாய், டீசல் செலவு மற்றும் நிகர லாபத் தணிக்கை.',
    'report.month_select': 'மாதத்தை தேர்ந்தெடுக்கவும்',
    'report.freight_total': 'மொத்த வாடகை வருவாய்',
    'report.diesel_total': 'மொத்த டீசல் செலவு',
    'report.net_profit': 'நிகர லாபம்',

    // Service & Maintenance Modal
    'service.title': 'வண்டி பராமரிப்பு / ஆயில் மாற்றம் பதிவு',
    'service.engine_oil': 'என்ஜின் ஆயில் மாற்றம் (Engine Oil)',
    'service.crown_oil': 'கிரவுன் ஆயில் மாற்றம் (Crown Oil)',
    'service.gear_oil': 'கியர் பாக்ஸ் ஆயில் (Gearbox Oil)',
    'service.greasing': 'கிரீசிங் செய்யப்பட்டது (Wheel Greasing)',
    'service.km': 'தற்போதைய கிலோமீட்டர் (Odometer KM)',

    // Offices & Account Ledgers
    'office.title': 'அலுவலக கிளைகள் (Offices & Branches)',
    'account.title': 'வங்கி மற்றும் ரொக்கக் கணக்குகள் (Account Ledgers)',
    'account.balance': 'தற்போதைய இருப்புத் தொகை (Balance)',

    // Language Selector UI
    'lang.select_title': 'மொழியைத் தேர்ந்தெடுக்கவும்',
    'lang.current': 'தமிழ்'
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.trucks': 'Trucks Master',
    'nav.drivers': 'Drivers Master',
    'nav.trips': 'Trip Registers',
    'nav.expenses': 'Expenses Vouchers',
    'nav.offices': 'Offices & Branches',
    'nav.accounts': 'Account Ledgers',
    'nav.tyres': 'Tyre Management',
    'nav.reports': 'Monthly Reports',
    'nav.audit': 'Audit Activity Logs',
    'nav.users': 'User Access Control',
    'nav.console': 'Console Control Room',

    'btn.new_trip': 'New Trip Entry',
    'btn.new_truck': 'Add Truck',
    'btn.new_driver': 'Add Driver',
    'btn.add_expense': 'Record Expense',
    'btn.save': 'Save Changes',
    'btn.cancel': 'Cancel',
    'btn.delete': 'Delete',
    'btn.edit': 'Edit',
    'btn.close': 'Close',
    'btn.search': 'Search...',
    'btn.export': 'Export Backup',
    'btn.import': 'Restore Backup',
    'btn.clear_data': 'Clear Data',
    'btn.backup': 'Backup',
    'btn.restore': 'Restore',
    'btn.logout': 'Sign Out',

    'dash.total_trucks': 'Total Fleet Trucks',
    'dash.active_trips': 'Active Trips',
    'dash.total_freight': 'Total Freight Income',
    'dash.total_expenses': 'Total Expenses',
    'dash.net_profit': 'Net Fleet Profit',
    'dash.driver_advances': 'Driver Advances',
    'dash.pending_approval': 'Pending Approval',

    'truck.number': 'Truck Number',
    'truck.owner': 'Owner',
    'truck.driver': 'Assigned Driver',
    'truck.status': 'Truck Status',
    'truck.status.available': 'Available',
    'truck.status.ontrip': 'On Trip',
    'truck.status.maintenance': 'Under Maintenance',

    'lang.select_title': 'Select Application Language',
    'lang.current': 'English'
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.trucks': 'ट्रक मास्टर',
    'nav.drivers': 'ड्राइवर मास्टर',
    'nav.trips': 'ट्रिप रजिस्टर',
    'nav.expenses': 'खर्च वाउचर',
    'nav.offices': 'कार्यालय और शाखाएं',
    'nav.accounts': 'खाता बही',
    'nav.tyres': 'टायर प्रबंधन',
    'nav.reports': 'मासिक रिपोर्ट',
    'nav.audit': 'गतिविधि लॉग',
    'nav.users': 'उपयोगकर्ता पहुंच',
    'nav.console': 'कंट्रोल रूम',

    'btn.new_trip': 'नई ट्रिप दर्ज करें',
    'btn.new_truck': 'ट्रक जोड़ें',
    'btn.new_driver': 'ड्राइवर जोड़ें',
    'btn.add_expense': 'खर्च दर्ज करें',
    'btn.save': 'सहेजें',
    'btn.cancel': 'रद्द करें',
    'btn.delete': 'हटाएं',
    'btn.edit': 'संपादित करें',
    'btn.close': 'बंद करें',
    'btn.search': 'खोजें...',
    'btn.export': 'बैकअप लें',
    'btn.import': 'रीस्टोर करें',
    'btn.clear_data': 'डेटा हटाएं',
    'btn.backup': 'बैकअप',
    'btn.restore': 'पुनर्प्राप्त करें',
    'btn.logout': 'साइन आउट',

    'dash.total_trucks': 'कुल ट्रक',
    'dash.active_trips': 'सक्रिय ट्रिप',
    'dash.total_freight': 'कुल भाड़ा आय',
    'dash.total_expenses': 'कुल खर्च',
    'dash.net_profit': 'शुद्ध लाभ',
    'dash.driver_advances': 'ड्राइवर अग्रिम',
    'dash.pending_approval': 'मंजूरी लंबित',

    'truck.number': 'ट्रक संख्या',
    'truck.owner': 'मालिक',
    'truck.driver': 'चालक',
    'truck.status': 'स्थिति',
    'truck.status.available': 'उपलब्ध',
    'truck.status.ontrip': 'ट्रिप पर',
    'truck.status.maintenance': 'रखरखाव में',

    'lang.select_title': 'भाषा चुनें',
    'lang.current': 'हिन्दी'
  },
  te: {
    'nav.dashboard': 'డాష్‌బోర్డ్',
    'nav.trucks': 'లారీలు (ట్రక్స్)',
    'nav.drivers': 'డ్రైవర్లు',
    'nav.trips': 'ట్రిప్ రికార్డులు',
    'nav.expenses': 'ఖర్చులు',
    'nav.offices': 'ఆఫీసులు / బ్రాంచీలు',
    'nav.accounts': 'ఖాతా పుస్తకాలు',
    'nav.tyres': 'టైర్ నిర్వహణ',
    'nav.reports': 'నెలవారీ రిపోర్టులు',
    'nav.audit': 'యాక్టివిటీ లాగ్స్',
    'nav.users': 'యూజర్ యాక్సెస్',
    'nav.console': 'కంట్రోల్ రూమ్',

    'btn.new_trip': 'కొత్త ట్రిప్ ఎంట్రీ',
    'btn.new_truck': 'లారీ జోడించండి',
    'btn.new_driver': 'డ్రైవర్ జోడించండి',
    'btn.add_expense': 'ఖర్చు నమోదు',
    'btn.save': 'సేవ్ చేయండి',
    'btn.cancel': 'రద్దు చేయి',
    'btn.delete': 'తొలగించు',
    'btn.edit': 'సవరించు',
    'btn.close': 'మూసివేయి',
    'btn.search': 'శోధించండి...',
    'btn.export': 'బ్యాకప్ చేయండి',
    'btn.import': 'రీస్టోర్ చేయండి',
    'btn.clear_data': 'డేటా క్లియర్',
    'btn.backup': 'బ్యాకప్',
    'btn.restore': 'రీస్టోర్',
    'btn.logout': 'లాగ్ అవుట్',

    'dash.total_trucks': 'మొత్తం లారీలు',
    'dash.active_trips': 'ప్రస్తుత ట్రిప్పులు',
    'dash.total_freight': 'మొత్తం బాడిగే ఆదాయం',
    'dash.total_expenses': 'మొత్తం ఖర్చులు',
    'dash.net_profit': 'నికర లాభం',
    'dash.driver_advances': 'డ్రైవర్ అడ్వాన్సులు',
    'dash.pending_approval': 'ఆమోదం పెండింగ్',

    'truck.number': 'లారీ నంబర్',
    'truck.owner': 'యజమాని',
    'truck.driver': 'డ్రైవర్',
    'truck.status': 'స్థితి',
    'truck.status.available': 'అందుబాటులో ఉంది',
    'truck.status.ontrip': 'ట్రిప్‌లో ఉంది',
    'truck.status.maintenance': 'మరమ్మత్తులో ఉంది',

    'lang.select_title': 'భాషను ఎంచుకోండి',
    'lang.current': 'తెలుగు'
  },
  kn: {
    'nav.dashboard': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'nav.trucks': 'ಟ್ರಕ್‍ಗಳು',
    'nav.drivers': 'ಚಾಲಕರು',
    'nav.trips': 'ಟ್ರಿಪ್ ವಿವರಗಳು',
    'nav.expenses': 'ಖರ್ಚುಗಳು',
    'nav.offices': 'ಕಚೇರಿಗಳು',
    'nav.accounts': 'ಖಾತೆ ಪುಸ್ತಕಗಳು',
    'nav.tyres': 'ಟೈರ್ ನಿರ್ವಹಣೆ',
    'nav.reports': 'ಮಾಸಿಕ ವರದಿ',
    'nav.audit': 'ಚಟುವಟಿಕೆ ದಾಖಲೆ',
    'nav.users': 'ಬಳಕೆದಾರರ ಪ್ರವೇಶ',
    'nav.console': 'ನಿಯಂತ್ರಣ ಕೊಠಡಿ',

    'btn.new_trip': 'ಹೊಸ ಟ್ರಿಪ್',
    'btn.new_truck': 'ಟ್ರಕ್ ಸೇರಿಸಿ',
    'btn.new_driver': 'ಚಾಲಕ ಸೇರಿಸಿ',
    'btn.add_expense': 'ಖರ್ಚು ನಮೂದಿಸಿ',
    'btn.save': 'ಉಳಿಸಿ',
    'btn.cancel': 'ರದ್ದುಗೊಳಿಸಿ',
    'btn.delete': 'ಅಳಿಸಿ',
    'btn.edit': 'ಸಂಪಾದಿಸಿ',
    'btn.close': 'ಮುಚ್ಚಿ',
    'btn.search': 'ಹುಡುಕಿ...',
    'btn.export': 'ಬ್ಯಾಕಪ್',
    'btn.import': 'ಮರುಸ್ಥಾಪಿಸಿ',
    'btn.clear_data': 'ಡೇಟಾ ಅಳಿಸಿ',
    'btn.backup': 'ಬ್ಯಾಕಪ್',
    'btn.restore': 'ಮರುಸ್ಥಾಪಿಸಿ',
    'btn.logout': 'ನಿರ್ಗಮಿಸಿ',

    'dash.total_trucks': 'ಒಟ್ಟು ಟ್ರಕ್‌ಗಳು',
    'dash.active_trips': 'ಸಕ್ರಿಯ ಟ್ರಿಪ್‌ಗಳು',
    'dash.total_freight': 'ಒಟ್ಟು ಬಾಡಿಗೆ ಆದಾಯ',
    'dash.total_expenses': 'ಒಟ್ಟು ಖರ್ಚುಗಳು',
    'dash.net_profit': 'ನಿವ್ವಳ ಲಾಭ',
    'dash.driver_advances': 'ಚಾಲಕರ ಮುಂಗಡ',
    'dash.pending_approval': 'ಅನುಮೋದನೆ ಬಾಕಿ',

    'truck.number': 'ಟ್ರಕ್ ಸಂಖ್ಯೆ',
    'truck.owner': 'ಮಾಲೀಕರು',
    'truck.driver': 'ಚಾಲಕ',
    'truck.status': 'ಸ್ಥಿತಿ',
    'truck.status.available': 'ಲಭ್ಯವಿದೆ',
    'truck.status.ontrip': 'ಟ್ರಿಪ್‌ನಲ್ಲಿದೆ',
    'truck.status.maintenance': 'ನಿರ್ವಹಣೆಯಲ್ಲಿದೆ',

    'lang.select_title': 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    'lang.current': 'ಕನ್ನಡ'
  },
  mr: {
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.trucks': 'ट्रक मास्टर',
    'nav.drivers': 'ड्रायव्हर मास्टर',
    'nav.trips': 'ट्रिप रजिस्टर',
    'nav.expenses': 'खर्च वाउचर',
    'nav.offices': 'कार्यालये आणि शाखा',
    'nav.accounts': 'खाते वह्या',
    'nav.tyres': 'टायर व्यवस्थापन',
    'nav.reports': 'मासिक अहवाल',
    'nav.audit': 'कृती लॉग',
    'nav.users': 'वापरकर्ता प्रवेश',
    'nav.console': 'नियंत्रण कक्ष',

    'btn.new_trip': 'नवीन ट्रिप नोंदवा',
    'btn.new_truck': 'ट्रक जोडा',
    'btn.new_driver': 'ड्रायव्हर जोडा',
    'btn.add_expense': 'खर्च नोंदवा',
    'btn.save': 'जतन करा',
    'btn.cancel': 'रद्द करा',
    'btn.delete': 'हटवा',
    'btn.edit': 'संपादित करा',
    'btn.close': 'बंद करा',
    'btn.search': 'शोधा...',
    'btn.export': 'बॅकअप घ्या',
    'btn.import': 'पुनर्प्राप्त करा',
    'btn.clear_data': 'डेटा हटवा',
    'btn.backup': 'बॅकअप',
    'btn.restore': 'पुनर्प्राप्ती',
    'btn.logout': 'साइन आउट',

    'dash.total_trucks': 'एकूण ट्रक',
    'dash.active_trips': 'सक्रिय ट्रिप',
    'dash.total_freight': 'एकूण भाडे उत्पन्न',
    'dash.total_expenses': 'एकूण खर्च',
    'dash.net_profit': 'निव्वळ नफा',
    'dash.driver_advances': 'ड्रायव्हर अ‍ॅडव्हान्स',
    'dash.pending_approval': 'मंजुरी प्रलंबित',

    'truck.number': 'ट्रक क्रमांक',
    'truck.owner': 'मालक',
    'truck.driver': 'चालक',
    'truck.status': 'स्थिती',
    'truck.status.available': 'उपलब्ध',
    'truck.status.ontrip': 'ट्रिपवर आहे',
    'truck.status.maintenance': 'दुरुस्तीमध्ये',

    'lang.select_title': 'भाषा निवडा',
    'lang.current': 'मराठी'
  }
};

interface LanguageContextType {
  language: () => LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>();

export function LanguageProvider(props: { children: JSX.Element }) {
  const getInitialLanguage = (): LanguageCode => {
    try {
      const saved = localStorage.getItem('ttt_app_language') as LanguageCode;
      if (saved && TRANSLATIONS[saved]) {
        return saved;
      }
    } catch {
      // Ignore SSR / localStorage restriction
    }
    return 'en';
  };

  const [language, setLanguageSignal] = createSignal<LanguageCode>(getInitialLanguage());

  onMount(() => {
    const saved = localStorage.getItem('ttt_app_language') as LanguageCode;
    if (saved && TRANSLATIONS[saved]) {
      setLanguageSignal(saved);
    }
  });

  const setLanguage = (code: LanguageCode) => {
    if (TRANSLATIONS[code]) {
      setLanguageSignal(code);
      localStorage.setItem('ttt_app_language', code);
    }
  };

  const t = (key: string, fallback?: string): string => {
    const code = language();
    const langDict = TRANSLATIONS[code];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    // Fallback to English if translation key missing in target language
    if (TRANSLATIONS.en[key]) {
      return TRANSLATIONS.en[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {props.children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Provide safe fallback if invoked outside provider during initialization
    return {
      language: () => 'ta' as LanguageCode,
      setLanguage: (code: LanguageCode) => { localStorage.setItem('ttt_app_language', code); },
      t: (key: string, fallback?: string) => TRANSLATIONS.ta[key] || TRANSLATIONS.en[key] || fallback || key
    };
  }
  return context;
}
