export interface JobPosition {
  id: string;
  title: string;
  shortDescription: string;
  workingHours: string;
  primaryResponsibility?: string;
  coreTarget?: string;
  dailyExpectations: string[];
  responsibilities: string[];
  decisionMakingAuthority?: {
    independent: string;
    requiresApproval: string;
  };
  requiredSkills: string[];
}

export const DOORBLY_POSITIONS: JobPosition[] = [
  {
    id: 'district-manager',
    title: 'District Manager',
    shortDescription:
      'Lead complete district-level operations, manage the cross-functional district team, and drive ₹50,000+ daily district revenue.',
    workingHours: '9:00 AM – 6:00 PM',
    primaryResponsibility:
      'Manage the complete district-level team and operations and achieve the district revenue target.',
    coreTarget: '₹50,000+ daily district revenue',
    dailyExpectations: [
      '₹50,000+ daily district revenue achievement',
      'Daily performance review of all district verticals',
      'End-of-day operational and revenue reporting',
    ],
    responsibilities: [
      'Manage District Coordinator, Lead Generator, Customer Support Executives, Telecallers and HR.',
      'Allocate daily targets.',
      'Monitor leads, calls, bookings and revenue.',
      'Drive lead-to-booking conversion.',
      'Coordinate customer acquisition and provider onboarding.',
      'Monitor team performance.',
      'Solve operational problems.',
      'Develop local business opportunities.',
      'Monitor service-provider availability.',
      'Support recruitment and manpower planning.',
      'Conduct daily performance reviews.',
      'Submit end-of-day reports.',
      'Take responsibility for overall district performance.',
    ],
    decisionMakingAuthority: {
      independent:
        'The District Manager can independently manage daily district operations, target allocation, lead distribution, field activities, customer follow-ups and operational priorities.',
      requiresApproval:
        'Major decisions involving salary, pricing, major expenses, contracts, permanent hiring/termination or company policy require management approval.',
    },
    requiredSkills: [
      'District P&L & Revenue Management',
      'Cross-functional Team Leadership',
      'Target Allocation & Conversion Tracking',
      'Service Provider Ecosystem Management',
      'Operational Problem Solving',
    ],
  },
  {
    id: 'district-coordinator',
    title: 'District Coordinator',
    shortDescription:
      'Coordinate district field activities, onboard and activate service providers, and build strong local partner networks.',
    workingHours: '9:00 AM – 6:00 PM',
    dailyExpectations: [
      '5–8 productive field visits',
      '5+ provider activations',
      '3–5 local business/partner meetings',
    ],
    responsibilities: [
      'Coordinate district field activities.',
      'Identify potential service providers.',
      'Onboard and activate service providers.',
      'Verify provider documents.',
      'Coordinate providers with customer requirements.',
      'Conduct field visits.',
      'Develop local business relationships.',
      'Identify service gaps.',
      'Follow up with providers.',
      'Monitor provider performance.',
      'Resolve field-level operational issues.',
      'Submit daily field reports.',
    ],
    requiredSkills: [
      'Field Operations & Route Planning',
      'Vendor / Provider Onboarding',
      'Document Verification',
      'Local Business Development',
      'On-ground Issue Resolution',
    ],
  },
  {
    id: 'lead-generator',
    title: 'Lead Generator',
    shortDescription:
      'Generate, qualify, and maintain high-intent customer leads across online and offline channels to fuel district bookings.',
    workingHours: '9:00 AM – 6:00 PM',
    dailyExpectations: ['50–70 qualified leads'],
    responsibilities: [
      'Generate new customer leads.',
      'Identify potential customers.',
      'Generate leads through online and offline sources.',
      'Collect accurate customer information.',
      'Qualify leads.',
      'Maintain lead records.',
      'Avoid duplicate or invalid leads.',
      'Coordinate with Telecallers and Customer Support.',
      'Identify high-potential leads.',
      'Explore new lead sources.',
      'Submit daily lead reports.',
    ],
    requiredSkills: [
      'Online & Offline Lead Sourcing',
      'Lead Qualification & Data Accuracy',
      'Spreadsheet & CRM Hygiene',
      'Market Research & Territory Mapping',
      'Cross-team Coordination',
    ],
  },
  {
    id: 'customer-support-executive',
    title: 'Customer Support Executive',
    shortDescription:
      'Handle customer enquiries, recommend suitable Doorbly services, convert qualified leads into confirmed bookings, and ensure satisfaction.',
    workingHours: '9:00 AM – 6:00 PM',
    dailyExpectations: ['10–15 bookings and 30+ customer follow-ups'],
    responsibilities: [
      'Handle customer enquiries.',
      'Understand customer requirements.',
      'Recommend suitable Doorbly services.',
      'Convert qualified leads into bookings.',
      'Follow up with customers.',
      'Coordinate with service providers.',
      'Confirm booking details.',
      'Handle routine customer complaints.',
      'Resolve issues according to company policy.',
      'Follow up on cancelled and pending bookings.',
      'Encourage repeat bookings.',
      'Maintain customer and booking records.',
    ],
    requiredSkills: [
      'Consultative Customer Communication',
      'Lead-to-Booking Conversion',
      'Service Provider Coordination',
      'Complaint Resolution & De-escalation',
      'Booking Record Management',
    ],
  },
  {
    id: 'telecaller',
    title: 'Telecaller',
    shortDescription:
      'Execute high-volume outbound calling to new and existing leads, explain Doorbly services, and generate qualified booking opportunities.',
    workingHours: '9:00 AM – 6:00 PM',
    dailyExpectations: ['80–120 calls and 10+ qualified opportunities/conversions'],
    responsibilities: [
      'Make outbound calls.',
      'Contact new leads.',
      'Explain Doorbly services.',
      'Understand customer requirements.',
      'Follow up with interested customers.',
      'Reactivate old leads.',
      'Identify hot prospects.',
      'Forward qualified opportunities to Customer Support.',
      'Maintain call records.',
      'Coordinate with service providers when required.',
      'Achieve daily calling and conversion targets.',
    ],
    requiredSkills: [
      'High-Volume Outbound Calling',
      'Clear Verbal Persuasion',
      'Lead Reactivation & Follow-up',
      'Call Logging & Disposition Tracking',
      'Target-Driven Execution',
    ],
  },
  {
    id: 'hr-executive',
    title: 'HR Executive',
    shortDescription:
      'Manage end-to-end district recruitment, candidate screening, KYC verification, employee onboarding, and attendance tracking.',
    workingHours: '9:00 AM – 6:00 PM',
    dailyExpectations: ['3–5 candidate interviews where recruitment is required'],
    responsibilities: [
      'Source candidates.',
      'Screen applicants.',
      'Conduct or coordinate interviews.',
      'Maintain candidate records.',
      'Coordinate joining and onboarding.',
      'Verify required documents.',
      'Track attendance.',
      'Monitor manpower requirements.',
      'Coordinate staffing requirements with the District Manager.',
      'Monitor employee productivity.',
      'Maintain employee records.',
      'Support employee-related issues.',
      'Maintain confidentiality.',
      'Prepare HR reports.',
    ],
    requiredSkills: [
      'Talent Sourcing & Screening',
      'Interview Coordination',
      'KYC Document Verification',
      'Employee Onboarding & Attendance',
      'HR Confidentiality & Reporting',
    ],
  },
];

export const REJECTION_REASONS = [
  'Qualification does not match',
  'Experience does not match',
  'Position filled',
  'KYC issue',
  'Candidate not suitable',
  'Other',
];

export const APPLICATION_STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string; textColor: string; bgColor: string; borderColor: string }
> = {
  SUBMITTED: {
    label: 'Submitted',
    dotColor: 'bg-sky-600',
    textColor: 'text-sky-800',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    dotColor: 'bg-indigo-600',
    textColor: 'text-indigo-800',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  SELECTED: {
    label: 'Selected',
    dotColor: 'bg-emerald-600',
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  REJECTED: {
    label: 'Rejected',
    dotColor: 'bg-rose-600',
    textColor: 'text-rose-800',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
  ON_HOLD: {
    label: 'On Hold',
    dotColor: 'bg-slate-500',
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
  },
};

export const KYC_STATUS_CONFIG: Record<
  string,
  { label: string; textColor: string; bgColor: string }
> = {
  PENDING: {
    label: 'Pending',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
  },
  VERIFIED: {
    label: 'Verified',
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
  },
  REJECTED: {
    label: 'Rejected',
    textColor: 'text-rose-800',
    bgColor: 'bg-rose-50',
  },
};
