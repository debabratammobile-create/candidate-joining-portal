import React, { useState, useRef } from 'react';
import { DOORBLY_POSITIONS, DOORBLY_LOGO_URL, JobPosition } from '../data/positions.ts';
import { supabase, isSupabaseConfigured, KYC_STORAGE_BUCKET } from '../lib/supabase.ts';
import heroDoorblyTeam from '../assets/images/hero_doorbly_team_1791344196731.jpg';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  FileText,
  X,
  Copy,
  Download,
  ShieldCheck,
  Clock,
  ChevronRight,
  AlertCircle,
  Menu,
} from 'lucide-react';

interface UploadedKycFile {
  documentType: 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'EDUCATIONAL_CERTIFICATE' | 'BANK_PASSBOOK';
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileDataUrl: string;
  rawFile?: File;
}

interface ApplicationFormState {
  // Step 1: Personal Information
  fullName: string;
  parentName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  alternateMobile: string;
  email: string;
  address: string;
  district: string;
  state: string;
  pinCode: string;

  // Step 2: Position & Experience
  appliedPosition: string;
  preferredLocation: string;
  experience: string;
  totalExperience: string;
  previousCompany: string;
  previousDesignation: string;
  expectedSalary: string;
  noticePeriod: string;

  // Step 3: Education, Skills & Emergency Contact
  highestQualification: string;
  institution: string;
  passingYear: string;
  additionalQualifications: string;
  skills: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobile: string;

  // Step 5: Declaration
  declarationAccepted: boolean;
}

const INITIAL_FORM_STATE: ApplicationFormState = {
  fullName: '',
  parentName: '',
  dateOfBirth: '',
  gender: '',
  mobile: '',
  alternateMobile: '',
  email: '',
  address: '',
  district: '',
  state: 'Odisha',
  pinCode: '',
  appliedPosition: '',
  preferredLocation: '',
  experience: 'Fresher',
  totalExperience: '0 Years',
  previousCompany: '',
  previousDesignation: '',
  expectedSalary: '',
  noticePeriod: 'Immediate',
  highestQualification: '',
  institution: '',
  passingYear: '',
  additionalQualifications: '',
  skills: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactMobile: '',
  declarationAccepted: false,
};

interface ApplicantPortalProps {
  onNavigateToAdmin: () => void;
}

export const ApplicantPortal: React.FC<ApplicantPortalProps> = ({ onNavigateToAdmin }) => {
  // View state: 'landing' | 'responsibilities' | 'form' | 'submitted'
  const [viewMode, setViewMode] = useState<'landing' | 'responsibilities' | 'form' | 'submitted'>('landing');
  const [selectedPosition, setSelectedPosition] = useState<JobPosition>(DOORBLY_POSITIONS[0]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<ApplicationFormState>({
    ...INITIAL_FORM_STATE,
    appliedPosition: DOORBLY_POSITIONS[0].title,
  });

  // KYC Document files
  const [aadhaarFront, setAadhaarFront] = useState<UploadedKycFile | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<UploadedKycFile | null>(null);
  const [eduCertificates, setEduCertificates] = useState<UploadedKycFile[]>([]);
  const [bankPassbook, setBankPassbook] = useState<UploadedKycFile | null>(null);

  // Submission & validation state
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [submittedAppNumber, setSubmittedAppNumber] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [heroImgError, setHeroImgError] = useState<boolean>(false);
  const [logoImgError, setLogoImgError] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const positionsSectionRef = useRef<HTMLElement | null>(null);
  const howItWorksRef = useRef<HTMLElement | null>(null);

  const handleSelectPosition = (pos: JobPosition) => {
    setSelectedPosition(pos);
    setFormData((prev) => ({
      ...prev,
      appliedPosition: pos.title,
      skills: prev.skills || pos.requiredSkills.slice(0, 3).join(', '),
    }));
    setFormError(null);
    setMobileMenuOpen(false);
    setViewMode('responsibilities');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartApplication = () => {
    setFormError(null);
    setMobileMenuOpen(false);
    setCurrentStep(1);
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateField = <K extends keyof ApplicationFormState>(
    field: K,
    value: ApplicationFormState[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError(null);
  };

  // Validate file size (max 5MB) and allowed format (PDF, JPG, JPEG, PNG) (#29)
  const processFileUpload = (
    file: File,
    docType: UploadedKycFile['documentType'],
    onSuccess: (uploaded: UploadedKycFile) => void
  ) => {
    setFormError(null);
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!allowedMimeTypes.includes(file.type) && !allowedExts.includes(ext)) {
      setFormError(
        `Unsupported format for "${file.name}". Allowed formats: PDF, JPG, JPEG, PNG.`
      );
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      setFormError(
        `File "${file.name}" exceeds the 5 MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onSuccess({
        documentType: docType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/png'),
        fileDataUrl: String(reader.result || ''),
        rawFile: file,
      });
    };
    reader.onerror = () => {
      setFormError(`Could not read file "${file.name}". Please try again.`);
    };
    reader.readAsDataURL(file);
  };

  const validateCurrentStep = (step: number): boolean => {
    setFormError(null);

    if (step === 1) {
      if (!formData.fullName.trim()) {
        setFormError('Please enter your Full Name.');
        return false;
      }
      if (!formData.parentName.trim()) {
        setFormError("Please enter your Father's / Mother's Name.");
        return false;
      }
      if (!formData.dateOfBirth) {
        setFormError('Please select your Date of Birth.');
        return false;
      }
      if (!formData.gender) {
        setFormError('Please select your Gender.');
        return false;
      }
      if (!/^[6-9]\d{9}$/.test(formData.mobile.trim())) {
        setFormError('Please enter a valid 10-digit Indian Mobile Number (starting with 6-9).');
        return false;
      }
      if (
        formData.alternateMobile.trim() &&
        !/^[6-9]\d{9}$/.test(formData.alternateMobile.trim())
      ) {
        setFormError('Alternate Mobile Number must be a valid 10-digit Indian number.');
        return false;
      }
      if (
        formData.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
      ) {
        setFormError('Please enter a valid Email Address.');
        return false;
      }
      if (!formData.address.trim()) {
        setFormError('Please enter your Full Address.');
        return false;
      }
      if (!formData.district.trim()) {
        setFormError('Please enter your District.');
        return false;
      }
      if (!formData.state.trim()) {
        setFormError('Please enter your State.');
        return false;
      }
      if (!/^[1-9]\d{5}$/.test(formData.pinCode.trim())) {
        setFormError('Please enter a valid 6-digit PIN Code.');
        return false;
      }
    } else if (step === 2) {
      if (!formData.appliedPosition) {
        setFormError('Applied Position is required.');
        return false;
      }
      if (!formData.preferredLocation.trim()) {
        setFormError('Please enter your Preferred Work Location.');
        return false;
      }
      if (!formData.experience) {
        setFormError('Please specify whether you are a Fresher or Experienced.');
        return false;
      }
      if (!formData.totalExperience.trim()) {
        setFormError('Please enter your Total Experience.');
        return false;
      }
      if (!formData.expectedSalary.trim()) {
        setFormError('Please enter your Expected Monthly Salary.');
        return false;
      }
      if (!formData.noticePeriod.trim()) {
        setFormError('Please enter your Notice Period.');
        return false;
      }
    } else if (step === 3) {
      if (!formData.highestQualification.trim()) {
        setFormError('Please enter your Highest Qualification.');
        return false;
      }
      if (!formData.institution.trim()) {
        setFormError('Please enter your Institution / College Name.');
        return false;
      }
      if (!/^\d{4}$/.test(formData.passingYear.trim())) {
        setFormError('Please enter a valid 4-digit Passing Year (e.g., 2022).');
        return false;
      }
      if (!formData.skills.trim()) {
        setFormError('Please enter your relevant skills.');
        return false;
      }
      if (!formData.emergencyContactName.trim()) {
        setFormError('Please enter an Emergency Contact Name.');
        return false;
      }
      if (!formData.emergencyContactRelationship.trim()) {
        setFormError('Please enter your Relationship with the Emergency Contact.');
        return false;
      }
      if (!/^[6-9]\d{9}$/.test(formData.emergencyContactMobile.trim())) {
        setFormError('Please enter a valid 10-digit Emergency Contact Mobile Number.');
        return false;
      }
    } else if (step === 4) {
      if (!aadhaarFront) {
        setFormError('Please upload the Front Side of your Aadhaar Card.');
        return false;
      }
      if (!aadhaarBack) {
        setFormError('Please upload the Back Side of your Aadhaar Card.');
        return false;
      }
      if (eduCertificates.length === 0) {
        setFormError('Please upload at least one Educational Certificate.');
        return false;
      }
      if (!bankPassbook) {
        setFormError('Please upload the First Page of your Bank Passbook.');
        return false;
      }
    } else if (step === 5) {
      if (!formData.declarationAccepted) {
        setFormError('You must accept the Applicant Declaration before proceeding.');
        return false;
      }
    }

    return true;
  };

  const handleNextStep = async () => {
    if (!validateCurrentStep(currentStep)) return;

    // On Step 2 completion, check duplicate application protection (#28)
    if (currentStep === 2) {
      try {
        const dupRes = await fetch('/api/applications/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: formData.mobile.trim(),
            email: formData.email.trim(),
            appliedPosition: formData.appliedPosition,
          }),
        });
        if (dupRes.status === 409) {
          const dupData = await dupRes.json();
          setFormError(
            dupData.message ||
              'An application already exists with these details. Please contact Doorbly recruitment support if you need to update your application.'
          );
          return;
        }
      } catch (e) {
        console.error('Duplicate check warning:', e);
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, 6));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitApplication = async () => {
    for (let s = 1; s <= 5; s++) {
      if (!validateCurrentStep(s)) {
        setCurrentStep(s);
        return;
      }
    }

    setIsSubmitting(true);
    setUploadProgress(15);
    setFormError(null);

    try {
      const allKycDocs: UploadedKycFile[] = [
        aadhaarFront!,
        aadhaarBack!,
        ...eduCertificates,
        bankPassbook!,
      ];

      setUploadProgress(35);

      const preparedDocs = [];
      const timestampFolder = `${Date.now()}_${formData.mobile.trim().slice(-4)}`;

      for (let i = 0; i < allKycDocs.length; i++) {
        const doc = allKycDocs[i];
        const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `candidate-kyc/${timestampFolder}/${doc.documentType}_${i + 1}_${safeName}`;

        // Upload to private Supabase Storage bucket if external Supabase credentials are set
        if (isSupabaseConfigured && supabase && doc.rawFile) {
          await supabase.storage
            .from(KYC_STORAGE_BUCKET)
            .upload(storagePath, doc.rawFile, { upsert: false });
        }

        preparedDocs.push({
          documentType: doc.documentType,
          fileName: doc.fileName,
          storagePath,
          fileDataUrl: doc.fileDataUrl,
          mimeType: doc.mimeType,
        });

        setUploadProgress(35 + Math.round(((i + 1) / allKycDocs.length) * 40));
      }

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          documents: preparedDocs,
        }),
      });

      setUploadProgress(95);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to submit application. Please review your details and try again.'
        );
      }

      setUploadProgress(100);
      setSubmittedAppNumber(data.applicationNumber);
      setViewMode('submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(err.message || 'Network or upload error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveApplicationId = () => {
    navigator.clipboard?.writeText(submittedAppNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 3000);

    // Also trigger a clean acknowledgment receipt text download
    const receiptContent = [
      '====================================================',
      'DOORBLY — RECRUITMENT & EMPLOYEE JOINING PORTAL',
      'Official Application Acknowledgment Receipt',
      '====================================================',
      `Application ID   : ${submittedAppNumber}`,
      `Applicant Name   : ${formData.fullName}`,
      `Applied Position : ${formData.appliedPosition}`,
      `Preferred City   : ${formData.preferredLocation} (${formData.district}, ${formData.state})`,
      `Status           : SUBMITTED (Under Review)`,
      `Submitted Date   : ${new Date().toLocaleString()}`,
      '----------------------------------------------------',
      'Please keep this Application ID safe for future tracking.',
      '====================================================',
    ].join('\n');

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${submittedAppNumber}_Doorbly_Application_Receipt.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh w-full flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Top Bar Contract: Zone 1 Brand | Zone 2 Nav Links | Zone 3 Primary Action */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-14 flex items-center">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-2">
          {/* Zone 1: Company Logo + Brand */}
          <button
            type="button"
            onClick={() => {
              setViewMode('landing');
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 cursor-pointer shrink-0 py-1"
          >
            {!logoImgError && (
              <img
                src={DOORBLY_LOGO_URL}
                alt="Doorbly Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoImgError(true)}
                className="h-8 sm:h-9 w-auto object-contain"
              />
            )}
            <span>DOORBLY</span>
          </button>

          {/* Zone 2: 4 clean text navigation links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                setViewMode('landing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('landing');
                setTimeout(() => {
                  positionsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap"
            >
              Available Positions
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('landing');
                setTimeout(() => {
                  howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'landing') {
                  positionsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  handleStartApplication();
                }
              }}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap"
            >
              Apply Now
            </button>
          </nav>

          {/* Zone 3: 1-2 primary actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              Admin Portal
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'landing') {
                  positionsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  handleStartApplication();
                }
              }}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Apply Now
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              setViewMode('landing');
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full text-left py-2.5 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-lg"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('landing');
              setMobileMenuOpen(false);
              setTimeout(() => {
                positionsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="w-full text-left py-2.5 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-lg"
          >
            Available Positions
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('landing');
              setMobileMenuOpen(false);
              setTimeout(() => {
                howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="w-full text-left py-2.5 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 rounded-lg"
          >
            How It Works
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {viewMode === 'landing' && (
          <>
            {/* Hero Section (#3) */}
            <section className="bg-slate-900 text-white border-b border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-7 space-y-5 sm:space-y-6">
                  <div className="text-xs font-medium text-teal-400 tracking-wide">
                    Doorbly Recruitment &amp; Employee Joining Portal · Working Hours 9:00 AM – 6:00 PM
                  </div>
                  <h1
                    className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Join Doorbly and Build Your Career
                  </h1>
                  <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl leading-relaxed">
                    Choose your position, complete your application and submit your documents for verification. We are expanding district operations across high-growth service hubs.
                  </p>
                  <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        positionsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="min-h-[44px] px-6 py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <span>Apply Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="min-h-[44px] px-5 py-3 text-sm font-medium text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors inline-flex items-center justify-center whitespace-nowrap cursor-pointer"
                    >
                      View Joining Process
                    </button>
                  </div>
                  <div className="pt-5 border-t border-slate-800 grid grid-cols-3 gap-3 sm:gap-6 text-left">
                    <div>
                      <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-white">6 Roles</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">District &amp; Office</div>
                    </div>
                    <div>
                      <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-white">9 AM – 6 PM</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Day Shift Schedule</div>
                    </div>
                    <div>
                      <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-white">100% Private</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Encrypted KYC</div>
                    </div>
                  </div>
                </div>

                {/* Hero Visual Asset with Zero-Broken-Image Fallback */}
                <div className="lg:col-span-5">
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-800 aspect-video lg:aspect-4/3">
                    {!heroImgError ? (
                      <img
                        src={heroDoorblyTeam}
                        alt="Doorbly district operations and recruitment team collaborating"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <ShieldCheck className="w-12 h-12 text-teal-400 mb-3" />
                        <p className="text-sm font-semibold text-white">
                          Doorbly District Operations Network
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Structured career pathways across district management, field coordination, and customer support.
                        </p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-5">
                      <div className="text-xs text-slate-200">
                        <span className="font-semibold text-white">District Expansion Drive</span> · Direct employee onboarding with transparent role responsibilities
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Available Positions Section (#4) */}
            <section
              ref={positionsSectionRef}
              id="positions"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
            >
              <div className="max-w-3xl mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Available Positions
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-2">
                  Select a position below to inspect the complete job responsibilities, daily expectations, and decision-making scope before starting your application.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {DOORBLY_POSITIONS.map((pos, idx) => (
                  <div
                    key={pos.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col justify-between hover:border-teal-600 transition-colors"
                  >
                    <div>
                      {/* Clean unboxed metadata kicker (Zero-Pill Discipline) */}
                      <div className="text-xs text-slate-500 font-mono tabular-nums mb-2">
                        <span>0{idx + 1}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>Working Hours: {pos.workingHours}</span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900">{pos.title}</h3>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        {pos.shortDescription}
                      </p>

                      {/* Daily Expectations */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-900 mb-1.5">
                          Daily Expectations
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700">
                          {pos.dailyExpectations.map((exp, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-teal-700 font-bold">·</span>
                              <span className="font-medium">{exp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Key Responsibilities Preview */}
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-900 mb-1.5">
                          Key Responsibilities ({pos.responsibilities.length} total)
                        </div>
                        <ul className="space-y-1 text-xs text-slate-600">
                          {pos.responsibilities.slice(0, 4).map((resp, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-slate-400">·</span>
                              <span>{resp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Required Skills */}
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-900 mb-1">
                          Required Skills
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {pos.requiredSkills.join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSelectPosition(pos)}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                      >
                        <span>View Full Responsibilities &amp; Apply</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* How It Works Section (#3) */}
            <section
              ref={howItWorksRef}
              id="how-it-works"
              className="bg-white border-t border-b border-slate-200 py-10 sm:py-16"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-8 sm:mb-12">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    How the Doorbly Joining Process Works
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 mt-2">
                    Complete your application and identity verification in four structured steps.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="border-t-2 border-teal-700 pt-4">
                    <div className="text-xs font-mono font-semibold text-teal-700 mb-1">
                      01. Select Role &amp; Review Scope
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Read Complete Responsibilities
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Choose from our 6 operational roles and review the exact daily expectations, working hours (9:00 AM – 6:00 PM), and performance targets.
                    </p>
                  </div>

                  <div className="border-t-2 border-slate-300 pt-4">
                    <div className="text-xs font-mono font-semibold text-slate-600 mb-1">
                      02. Complete 6-Step Form
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Personal, Experience &amp; Education
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Enter your personal details, district location, work history, qualifications, and emergency contact details in our guided multi-step form.
                    </p>
                  </div>

                  <div className="border-t-2 border-slate-300 pt-4">
                    <div className="text-xs font-mono font-semibold text-slate-600 mb-1">
                      03. Private KYC Upload
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Submit Verification Documents
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Upload clear copies of your Aadhaar Card (Front &amp; Back), Educational Certificates, and Bank Passbook first page into our private vault.
                    </p>
                  </div>

                  <div className="border-t-2 border-slate-300 pt-4">
                    <div className="text-xs font-mono font-semibold text-slate-600 mb-1">
                      04. Instant Application ID
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      HR Review &amp; Onboarding
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Receive your unique Application ID (e.g., DB-2026-000001) immediately upon submission while our HR &amp; Admin team verifies your profile.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Complete Job Responsibilities View before Application Form (#4, #5) */}
        {viewMode === 'responsibilities' && (
          <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <button
              type="button"
              onClick={() => setViewMode('landing')}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 mb-5 cursor-pointer py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Available Positions</span>
            </button>

            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="text-xs text-teal-700 font-medium mb-1">
                    Official Role Specification · Working Hours: {selectedPosition.workingHours}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {selectedPosition.title}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={handleStartApplication}
                  className="px-5 py-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>Proceed to Application Form</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {selectedPosition.primaryResponsibility && (
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs font-semibold text-slate-700">Primary Responsibility</div>
                  <p className="text-sm text-slate-900 font-medium mt-1">
                    {selectedPosition.primaryResponsibility}
                  </p>
                  {selectedPosition.coreTarget && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600">Core District Target:</span>
                      <span className="text-sm font-bold font-mono tabular-nums text-teal-800">
                        {selectedPosition.coreTarget}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 mb-3">
                    Complete Job Responsibilities
                  </h2>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {selectedPosition.responsibilities.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs text-teal-700 font-semibold mt-0.5">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-6">
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      Daily Expectations &amp; Shift
                    </h3>
                    <div className="text-xs text-slate-600 mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-700" />
                      <span>Standard Working Hours: {selectedPosition.workingHours}</span>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-800">
                      {selectedPosition.dailyExpectations.map((exp, idx) => (
                        <li key={idx} className="flex items-start gap-2 font-medium">
                          <span className="text-teal-700 font-bold">·</span>
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      Required Skills &amp; Competencies
                    </h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {selectedPosition.requiredSkills.map((skill, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-slate-400">·</span>
                          <span>{skill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedPosition.decisionMakingAuthority && (
                    <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        Decision-Making Authority
                      </h3>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          Independent Operational Authority:
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                          {selectedPosition.decisionMakingAuthority.independent}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-amber-200/80">
                        <div className="text-xs font-semibold text-slate-800">
                          Requires Management Approval:
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                          {selectedPosition.decisionMakingAuthority.requiresApproval}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Switch position selector if applicant wants to compare */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Switch Position:</span>
                  <select
                    value={selectedPosition.id}
                    onChange={(e) => {
                      const found = DOORBLY_POSITIONS.find((p) => p.id === e.target.value);
                      if (found) handleSelectPosition(found);
                    }}
                    className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white"
                  >
                    {DOORBLY_POSITIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleStartApplication}
                  className="w-full sm:w-auto px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Apply for {selectedPosition.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 6-Step Multi-Step Application Form (#6, #7, #9, #27) */}
        {viewMode === 'form' && (
          <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <button
                type="button"
                onClick={() => setViewMode('responsibilities')}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer py-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to {selectedPosition.title} Responsibilities</span>
              </button>
              <div className="text-xs font-mono text-slate-600">
                Position: <strong className="text-slate-900">{formData.appliedPosition}</strong>
              </div>
            </div>

            {/* Progress Indicator: 1 -> 2 -> 3 -> 4 -> 5 -> 6 (#27) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 mb-5">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                {[
                  { step: 1, title: 'Personal Info' },
                  { step: 2, title: 'Position & Experience' },
                  { step: 3, title: 'Education & Skills' },
                  { step: 4, title: 'KYC Documents' },
                  { step: 5, title: 'Review & Declaration' },
                  { step: 6, title: 'Submit' },
                ].map((item, idx, arr) => {
                  const isActive = currentStep === item.step;
                  const isCompleted = currentStep > item.step;
                  return (
                    <React.Fragment key={item.step}>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.step < currentStep) {
                            setFormError(null);
                            setCurrentStep(item.step);
                          }
                        }}
                        disabled={item.step > currentStep}
                        className={`flex items-center gap-1.5 text-left shrink-0 ${
                          item.step < currentStep ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-mono font-bold flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-teal-700 text-white'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500 border border-slate-300'
                          }`}
                        >
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : item.step}
                        </span>
                        <div className="hidden lg:block">
                          <div
                            className={`text-xs font-semibold whitespace-nowrap ${
                              isActive
                                ? 'text-slate-900'
                                : isCompleted
                                ? 'text-emerald-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {item.title}
                          </div>
                        </div>
                      </button>
                      {idx < arr.length - 1 && (
                        <span className="text-slate-300 font-mono text-xs shrink-0">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between lg:hidden text-xs">
                <span className="font-mono font-semibold text-teal-700">
                  Step {currentStep} of 6
                </span>
                <span className="font-semibold text-slate-800">
                  {
                    [
                      'Personal Information',
                      'Position & Work Experience',
                      'Education, Skills & Emergency Contact',
                      'KYC Verification Documents',
                      'Review & Declaration',
                      'Final Submission',
                    ][currentStep - 1]
                  }
                </span>
              </div>
            </div>

            {/* Validation Error Alert */}
            {formError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm font-medium">{formError}</div>
              </div>
            )}

            {/* Form Container */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              {/* STEP 1: PERSONAL INFORMATION */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="text-xs font-mono text-teal-700 font-semibold">
                      Step 1 of 6
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      Personal Information
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter your full legal name and residential details exactly as they appear on your Aadhaar card.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        placeholder="e.g., Rajesh Kumar Mohanty"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Father&apos;s / Mother&apos;s Name *
                      </label>
                      <input
                        type="text"
                        value={formData.parentName}
                        onChange={(e) => updateField('parentName', e.target.value)}
                        placeholder="e.g., Surendra Nath Mohanty"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Date of Birth *
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => updateField('dateOfBirth', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Gender *
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => updateField('gender', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Mobile Number (10-digit Indian number) *
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={formData.mobile}
                        onChange={(e) =>
                          updateField('mobile', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="9876543210"
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Alternate Mobile Number
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={formData.alternateMobile}
                        onChange={(e) =>
                          updateField('alternateMobile', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Optional 10-digit number"
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="applicant@example.com"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Full Residential Address *
                      </label>
                      <textarea
                        rows={2}
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        placeholder="House/Plot No., Street, Locality, Landmark"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        District *
                      </label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => updateField('district', e.target.value)}
                        placeholder="e.g., Khordha, Cuttack, Ganjam"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        State *
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        placeholder="e.g., Odisha"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        PIN Code (6 digits) *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={formData.pinCode}
                        onChange={(e) =>
                          updateField('pinCode', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="751001"
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: POSITION & EXPERIENCE */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="text-xs font-mono text-teal-700 font-semibold">
                      Step 2 of 6
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      Position &amp; Work Experience
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Your selected position is pre-filled automatically. Provide your location preference and work background.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Applied Position (Auto-filled)
                      </label>
                      <input
                        type="text"
                        value={formData.appliedPosition}
                        readOnly
                        className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-100 text-slate-800 border border-slate-300 rounded-lg cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Preferred Work Location *
                      </label>
                      <input
                        type="text"
                        value={formData.preferredLocation}
                        onChange={(e) => updateField('preferredLocation', e.target.value)}
                        placeholder="e.g., Bhubaneswar / Khordha"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Previous Work Experience *
                      </label>
                      <select
                        value={formData.experience}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateField('experience', val);
                          if (val === 'Fresher' && !formData.totalExperience) {
                            updateField('totalExperience', '0 Years');
                          }
                        }}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                      >
                        <option value="Fresher">Fresher</option>
                        <option value="Experienced">Experienced</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Total Experience *
                      </label>
                      <input
                        type="text"
                        value={formData.totalExperience}
                        onChange={(e) => updateField('totalExperience', e.target.value)}
                        placeholder="e.g., 2.5 Years or 0 Years"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Current / Previous Company
                      </label>
                      <input
                        type="text"
                        value={formData.previousCompany}
                        onChange={(e) => updateField('previousCompany', e.target.value)}
                        placeholder="Leave blank if Fresher"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Previous Designation
                      </label>
                      <input
                        type="text"
                        value={formData.previousDesignation}
                        onChange={(e) => updateField('previousDesignation', e.target.value)}
                        placeholder="e.g., Field Coordinator / Telecaller"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Expected Salary (Monthly) *
                      </label>
                      <input
                        type="text"
                        value={formData.expectedSalary}
                        onChange={(e) => updateField('expectedSalary', e.target.value)}
                        placeholder="e.g., ₹22,000 / month"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Notice Period *
                      </label>
                      <select
                        value={formData.noticePeriod}
                        onChange={(e) => updateField('noticePeriod', e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                      >
                        <option value="Immediate">Immediate Joiner</option>
                        <option value="7 Days">Within 7 Days</option>
                        <option value="15 Days">15 Days</option>
                        <option value="30 Days">30 Days</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: EDUCATION, SKILLS & EMERGENCY CONTACT */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="text-xs font-mono text-teal-700 font-semibold">
                      Step 3 of 6
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      Educational Information, Skills &amp; Emergency Contact
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Provide your academic background, relevant professional skills, and an emergency family contact.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Highest Qualification *
                      </label>
                      <input
                        type="text"
                        value={formData.highestQualification}
                        onChange={(e) => updateField('highestQualification', e.target.value)}
                        placeholder="e.g., MBA, B.Com, B.Tech, +2 Arts/Science"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Institution / College / University Name *
                      </label>
                      <input
                        type="text"
                        value={formData.institution}
                        onChange={(e) => updateField('institution', e.target.value)}
                        placeholder="e.g., Utkal University"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Passing Year (YYYY) *
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={formData.passingYear}
                        onChange={(e) =>
                          updateField('passingYear', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="2023"
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Additional Qualifications / Certifications
                      </label>
                      <input
                        type="text"
                        value={formData.additionalQualifications}
                        onChange={(e) =>
                          updateField('additionalQualifications', e.target.value)
                        }
                        placeholder="e.g., PGDCA, Tally ERP, Digital Marketing"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Relevant Skills *
                      </label>
                      <textarea
                        rows={2}
                        value={formData.skills}
                        onChange={(e) => updateField('skills', e.target.value)}
                        placeholder="Enter skills separated by commas (e.g., Team Management, Outbound Calling, Excel Reporting, Odia/Hindi Fluency)"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-4">
                      Emergency Contact Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Emergency Contact Name *
                        </label>
                        <input
                          type="text"
                          value={formData.emergencyContactName}
                          onChange={(e) =>
                            updateField('emergencyContactName', e.target.value)
                          }
                          placeholder="Full Name"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Relationship *
                        </label>
                        <input
                          type="text"
                          value={formData.emergencyContactRelationship}
                          onChange={(e) =>
                            updateField('emergencyContactRelationship', e.target.value)
                          }
                          placeholder="Father / Mother / Spouse"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Emergency Contact Mobile *
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          value={formData.emergencyContactMobile}
                          onChange={(e) =>
                            updateField(
                              'emergencyContactMobile',
                              e.target.value.replace(/\D/g, '')
                            )
                          }
                          placeholder="10-digit Mobile Number"
                          className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: KYC DOCUMENT UPLOAD (#7, #8) */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="text-xs font-mono text-teal-700 font-semibold">
                      Step 4 of 6
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      KYC Verification Documents
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-700 font-medium mt-1">
                      Your documents are required for identity and employment verification. Please upload clear and valid copies.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Allowed formats: PDF, JPG, JPEG, PNG · Maximum file size: 5 MB per document.
                    </p>
                  </div>

                  {/* 1. Aadhaar Card Front & Back */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      1. Aadhaar Card (Front &amp; Back Required) *
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Front Side */}
                      <div className="border border-slate-300 border-dashed rounded-xl p-4 bg-slate-50/70">
                        <div className="text-xs font-semibold text-slate-800 mb-1">
                          Aadhaar Card — Front Side *
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          Must clearly show Full Name, Date of Birth, Gender &amp; Photo
                        </p>
                        {aadhaarFront ? (
                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {aadhaarFront.fileName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAadhaarFront(null)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-700 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5 text-teal-700" />
                            <span>Select Front Side (PDF/JPG/PNG)</span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  processFileUpload(file, 'AADHAAR_FRONT', (uploaded) =>
                                    setAadhaarFront(uploaded)
                                  );
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Back Side */}
                      <div className="border border-slate-300 border-dashed rounded-xl p-4 bg-slate-50/70">
                        <div className="text-xs font-semibold text-slate-800 mb-1">
                          Aadhaar Card — Back Side *
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          Must clearly show Residential Address &amp; PIN Code
                        </p>
                        {aadhaarBack ? (
                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {aadhaarBack.fileName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAadhaarBack(null)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-700 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5 text-teal-700" />
                            <span>Select Back Side (PDF/JPG/PNG)</span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  processFileUpload(file, 'AADHAAR_BACK', (uploaded) =>
                                    setAadhaarBack(uploaded)
                                  );
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Educational Certificates (Multiple Allowed) */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          2. Educational Certificates (Multiple uploads allowed) *
                        </h3>
                        <p className="text-xs text-slate-500">
                          Upload 10th, 12th, Graduation, Diploma or other relevant certificates.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-700 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors self-start">
                        <Upload className="w-3.5 h-3.5 text-teal-700" />
                        <span>Add Certificate</span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach((file) => {
                              processFileUpload(
                                file,
                                'EDUCATIONAL_CERTIFICATE',
                                (uploaded) => {
                                  setEduCertificates((prev) => [...prev, uploaded]);
                                }
                              );
                            });
                          }}
                        />
                      </label>
                    </div>

                    {eduCertificates.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {eduCertificates.map((cert, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {cert.fileName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEduCertificates((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 border-dashed rounded-lg p-4 text-center">
                        No educational certificates uploaded yet. Click &ldquo;Add Certificate&rdquo; above.
                      </div>
                    )}
                  </div>

                  {/* 3. Bank Passbook First Page */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900">
                      3. First Page of Bank Passbook *
                    </h3>
                    <p className="text-xs text-slate-500">
                      Must clearly show: Account holder name, Bank name, Account number, and IFSC code. Sensitive bank details are encrypted and never displayed publicly.
                    </p>
                    <div className="border border-slate-300 border-dashed rounded-xl p-4 bg-slate-50/70">
                      {bankPassbook ? (
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {bankPassbook.fileName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBankPassbook(null)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-700 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5 text-teal-700" />
                          <span>Upload Bank Passbook First Page (PDF/JPG/PNG)</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                processFileUpload(file, 'BANK_PASSBOOK', (uploaded) =>
                                  setBankPassbook(uploaded)
                                );
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW & DECLARATION (#9) */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="text-xs font-mono text-teal-700 font-semibold">
                      Step 5 of 6
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      Review Application &amp; Declaration
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Please verify all your entered details and accept the Applicant Declaration below.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="font-bold text-slate-900 text-sm mb-2">
                        Personal &amp; Contact Summary
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Full Name:</span>
                        <span className="font-semibold text-slate-900">{formData.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Parent Name:</span>
                        <span className="font-medium text-slate-800">{formData.parentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">DOB / Gender:</span>
                        <span className="font-medium text-slate-800">
                          {formData.dateOfBirth} · {formData.gender}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mobile:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {formData.mobile}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Location:</span>
                        <span className="font-medium text-slate-800">
                          {formData.district}, {formData.state} - {formData.pinCode}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="font-bold text-slate-900 text-sm mb-2">
                        Position, Education &amp; KYC Files
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Applied Position:</span>
                        <span className="font-semibold text-teal-800">
                          {formData.appliedPosition}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Experience:</span>
                        <span className="font-medium text-slate-800">
                          {formData.experience} ({formData.totalExperience})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Expected Salary:</span>
                        <span className="font-mono font-medium text-slate-800">
                          {formData.expectedSalary}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Qualification:</span>
                        <span className="font-medium text-slate-800">
                          {formData.highestQualification} ({formData.passingYear})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">KYC Documents Attached:</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {2 + eduCertificates.length + 1} Validated Files
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Applicant Declaration Box (#9) */}
                  <div className="p-5 bg-slate-50 border border-slate-300 rounded-xl space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Applicant Declaration
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                      &ldquo;I confirm that the information and documents submitted by me are true and accurate to the best of my knowledge. I authorize Doorbly to use the submitted information and documents for recruitment, identity verification and employment-related purposes.&rdquo;
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        checked={formData.declarationAccepted}
                        onChange={(e) =>
                          updateField('declarationAccepted', e.target.checked)
                        }
                        className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-slate-900">
                        I agree to the above declaration and authorize Doorbly to verify my submitted information and documents.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 6: FINAL SUBMIT STEP (#10, #27) */}
              {currentStep === 6 && (
                <div className="space-y-6 text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-teal-700 font-semibold">
                      Step 6 of 6 · Final Submission
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mt-1">
                      Ready to Submit Your Application
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2">
                      You are applying for <strong>{formData.appliedPosition}</strong> ({formData.preferredLocation}). Your KYC documents will be encrypted and uploaded to our private verification vault.
                    </p>
                  </div>

                  {isSubmitting && (
                    <div className="max-w-md mx-auto space-y-2 pt-2">
                      <div className="flex justify-between text-xs font-mono text-slate-600">
                        <span>Uploading KYC Documents &amp; Creating Record...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-700 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handlePrevStep}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Review / Edit Details
                    </button>
                    <button
                      type="button"
                      disabled={!formData.declarationAccepted || isSubmitting}
                      onClick={handleSubmitApplication}
                      className={`px-8 py-3 text-sm font-semibold text-white rounded-lg transition-colors inline-flex items-center gap-2 ${
                        !formData.declarationAccepted || isSubmitting
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-teal-700 hover:bg-teal-800 cursor-pointer'
                      }`}
                    >
                      <span>{isSubmitting ? 'Submitting Application...' : 'Submit Application'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step Navigation Footer (for Steps 1-5) */}
              {currentStep < 6 && (
                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={
                      currentStep === 1
                        ? () => setViewMode('responsibilities')
                        : handlePrevStep
                    }
                    className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{currentStep === 1 ? 'Back to Responsibilities' : 'Previous Step'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={currentStep === 5 && !formData.declarationAccepted}
                    onClick={handleNextStep}
                    className={`min-h-[44px] px-6 py-2.5 text-xs font-semibold text-white rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
                      currentStep === 5 && !formData.declarationAccepted
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-slate-900 hover:bg-teal-700 cursor-pointer'
                    }`}
                  >
                    <span>
                      {currentStep === 5 ? 'Proceed to Final Submit' : 'Save & Continue'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Application Submitted Confirmation Screen (#10) */}
        {viewMode === 'submitted' && (
          <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 text-center space-y-6 shadow-2xs">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Application Submitted Successfully
                </h1>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Thank you for applying to Doorbly. Your application has been successfully submitted and is under review.
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Official Application ID
                </div>
                <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-teal-800 mt-1 break-all">
                  Application ID: {submittedAppNumber}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Position: <strong className="text-slate-800">{formData.appliedPosition}</strong> · Status: <strong className="text-amber-700">SUBMITTED (Under Review)</strong>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveApplicationId}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedId ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Application ID Copied &amp; Saved!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Save Application ID</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(submittedAppNumber);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2500);
                  }}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy ID to Clipboard</span>
                </button>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...INITIAL_FORM_STATE,
                      appliedPosition: DOORBLY_POSITIONS[0].title,
                    });
                    setAadhaarFront(null);
                    setAadhaarBack(null);
                    setEduCertificates([]);
                    setBankPassbook(null);
                    setViewMode('landing');
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer py-1"
                >
                  Return to Doorbly Recruitment Home
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Quiet Corporate Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2.5">
            {!logoImgError && (
              <img
                src={DOORBLY_LOGO_URL}
                alt="Doorbly Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoImgError(true)}
                className="h-6 w-auto object-contain"
              />
            )}
            <span>
              <strong className="font-bold text-slate-900">DOORBLY</strong> · Recruitment &amp; Employee Joining Portal
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => {
                setViewMode('landing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-900 cursor-pointer py-1"
            >
              Applicant Portal
            </button>
            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="hover:text-slate-900 cursor-pointer py-1"
            >
              Admin Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
