import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DOORBLY_POSITIONS,
  DOORBLY_LOGO_URL,
  REJECTION_REASONS,
  APPLICATION_STATUS_CONFIG,
  KYC_STATUS_CONFIG,
} from '../data/positions.ts';
import { supabase, isSupabaseConfigured, KYC_STORAGE_BUCKET } from '../lib/supabase.ts';
import {
  Search,
  Download,
  LogOut,
  Eye,
  Check,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Clock,
  ShieldCheck,
  RefreshCw,
  Menu,
} from 'lucide-react';

export interface CandidateDocumentItem {
  id: string;
  applicationId: string;
  documentType: 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'EDUCATIONAL_CERTIFICATE' | 'BANK_PASSBOOK';
  fileName: string;
  storagePath: string;
  mimeType?: string;
  uploadedAt: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  remarks?: string | null;
}

export interface ActivityLogItem {
  id: string;
  applicationId: string;
  action: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  remarks?: string | null;
  performedBy: string;
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  applicationNumber: string;
  fullName: string;
  parentName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  alternateMobile?: string | null;
  email?: string | null;
  address: string;
  district: string;
  state: string;
  pinCode: string;
  appliedPosition: string;
  preferredLocation: string;
  experience: string;
  totalExperience: string;
  previousCompany?: string | null;
  previousDesignation?: string | null;
  expectedSalary: string;
  noticePeriod: string;
  highestQualification: string;
  institution: string;
  passingYear: string;
  additionalQualifications?: string | null;
  skills: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobile: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED' | 'ON_HOLD';
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  documents?: CandidateDocumentItem[];
  activityLogs?: ActivityLogItem[];
}

interface AdminDashboardProps {
  onNavigateToApply: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToApply }) => {
  const { admin, token, logout } = useAuth();

  // Active workspace view: 'spreadsheet' | 'roles'
  const [activeNav, setActiveNav] = useState<'spreadsheet' | 'roles'>('spreadsheet');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [logoError, setLogoError] = useState<boolean>(false);

  // Applications list state
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search (#14)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [kycFilter, setKycFilter] = useState<string>('ALL');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');

  // Sorting & Pagination (#15)
  const [sortField, setSortField] = useState<
    'applicationNumber' | 'fullName' | 'appliedPosition' | 'district' | 'createdAt'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Bulk Selection (#20)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState<boolean>(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState<string>(REJECTION_REASONS[0]);

  // Selected Applicant Details Drawer (#16)
  const [activeApplicant, setActiveApplicant] = useState<ApplicationRecord | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [remarkDraft, setRemarkDraft] = useState<string>('');

  // Select / Reject Candidate Modals (#18)
  const [showSelectConfirmModal, setShowSelectConfirmModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReasonSelect, setRejectionReasonSelect] = useState<string>(REJECTION_REASONS[0]);
  const [customRejectionText, setCustomRejectionText] = useState<string>('');

  // Document Reject Reason Modal (#17)
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [docRejectReason, setDocRejectReason] = useState<string>('Document is unclear');

  // Authenticated Document Viewer Modal (#16)
  const [viewingDocument, setViewingDocument] = useState<{
    fileName: string;
    documentType: string;
    storagePath: string;
    signedDataUrl: string;
    expiresInSeconds: number;
  } | null>(null);

  // Admin Users Role Management (#25)
  const [adminUsersList, setAdminUsersList] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchApplications = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetch('/api/admin/applications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setApplications(data.applications || []);
        }
      } catch (err) {
        console.error('Error loading applications:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  const fetchAdminUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminUsersList(data.users || []);
      }
    } catch (e) {
      console.error('Error fetching admin users:', e);
    }
  }, [token]);

  // Initial load + Live data synchronization (#31)
  useEffect(() => {
    fetchApplications();
    fetchAdminUsers();

    // Poll every 8 seconds for live updates + subscribe to Supabase Realtime if configured
    const interval = setInterval(() => {
      fetchApplications(true);
    }, 8000);

    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('doorbly-live-applications')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_applications' },
          () => {
            fetchApplications(true);
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchApplications, fetchAdminUsers]);

  // Open applicant details drawer (#16)
  const openApplicantDetails = async (appId: string) => {
    if (!token) return;
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/admin/applications/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveApplicant(data.application);
        setRemarkDraft(data.application.adminRemarks || '');
      }
    } catch (e) {
      console.error('Error fetching applicant details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Summary card counts (#14)
  const summaryStats = useMemo(() => {
    return {
      total: applications.length,
      submitted: applications.filter((a) => a.status === 'SUBMITTED').length,
      underReview: applications.filter((a) => a.status === 'UNDER_REVIEW').length,
      shortlisted: applications.filter((a) => a.status === 'SHORTLISTED').length,
      selected: applications.filter((a) => a.status === 'SELECTED').length,
      rejected: applications.filter((a) => a.status === 'REJECTED').length,
      pendingKyc: applications.filter((a) => a.kycStatus === 'PENDING').length,
    };
  }, [applications]);

  // Unique Districts & States for filter dropdowns
  const uniqueDistricts = useMemo(
    () => Array.from(new Set(applications.map((a) => a.district))).sort(),
    [applications]
  );
  const uniqueStates = useMemo(
    () => Array.from(new Set(applications.map((a) => a.state))).sort(),
    [applications]
  );

  // Filtered & Sorted applications (#14, #15)
  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return applications
      .filter((app) => {
        if (q) {
          const matchId = app.applicationNumber.toLowerCase().includes(q);
          const matchName = app.fullName.toLowerCase().includes(q);
          const matchMobile = app.mobile.toLowerCase().includes(q);
          const matchEmail = (app.email || '').toLowerCase().includes(q);
          if (!matchId && !matchName && !matchMobile && !matchEmail) return false;
        }
        if (positionFilter !== 'ALL' && app.appliedPosition !== positionFilter) return false;
        if (districtFilter !== 'ALL' && app.district !== districtFilter) return false;
        if (stateFilter !== 'ALL' && app.state !== stateFilter) return false;
        if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
        if (kycFilter !== 'ALL' && app.kycStatus !== kycFilter) return false;

        if (dateFromFilter) {
          const appDate = new Date(app.createdAt).toISOString().slice(0, 10);
          if (appDate < dateFromFilter) return false;
        }
        if (dateToFilter) {
          const appDate = new Date(app.createdAt).toISOString().slice(0, 10);
          if (appDate > dateToFilter) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = String(a[sortField] || '');
        let valB = String(b[sortField] || '');
        if (sortField === 'createdAt') {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      });
  }, [
    applications,
    searchQuery,
    positionFilter,
    districtFilter,
    stateFilter,
    statusFilter,
    kycFilter,
    dateFromFilter,
    dateToFilter,
    sortField,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, currentPage]);

  const toggleSort = (
    field: 'applicationNumber' | 'fullName' | 'appliedPosition' | 'district' | 'createdAt'
  ) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Update status / remarks (#18, #19, #22)
  const handleStatusUpdate = async (
    appId: string,
    newStatus?: string,
    rejectionReason?: string,
    adminRemarks?: string
  ) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/applications/${appId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          rejectionReason,
          adminRemarks,
          performedBy: `${admin?.name || 'Admin'} (${admin?.role || 'ADMIN'})`,
        }),
      });
      if (res.ok) {
        showToast(
          newStatus
            ? `Application status updated to ${newStatus}`
            : 'Internal administrator remark saved'
        );
        await fetchApplications(true);
        if (activeApplicant && activeApplicant.id === appId) {
          await openApplicantDetails(appId);
        }
      }
    } catch (e) {
      console.error('Status update error:', e);
    }
  };

  // Document Verify / Reject (#17)
  const handleDocumentVerification = async (
    docId: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    remarks?: string
  ) => {
    if (!token || !activeApplicant) return;
    try {
      const res = await fetch(`/api/admin/documents/${docId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verificationStatus,
          remarks,
          performedBy: `${admin?.name || 'Admin'} (${admin?.role || 'ADMIN'})`,
        }),
      });
      if (res.ok) {
        showToast(`Document marked as ${verificationStatus}`);
        setRejectingDocId(null);
        await fetchApplications(true);
        await openApplicantDetails(activeApplicant.id);
      }
    } catch (e) {
      console.error('Error verifying document:', e);
    }
  };

  // Secure View Document via authenticated access (#16)
  const handleSecureViewDocument = async (doc: CandidateDocumentItem) => {
    if (!token) return;
    try {
      // If external Supabase Storage is configured, try generating a 60-second signed URL first
      if (isSupabaseConfigured && supabase) {
        const cleanPath = doc.storagePath.replace(/^candidate-kyc\//, '');
        const { data } = await supabase.storage
          .from(KYC_STORAGE_BUCKET)
          .createSignedUrl(cleanPath, 60);
        if (data?.signedUrl) {
          setViewingDocument({
            fileName: doc.fileName,
            documentType: doc.documentType,
            storagePath: doc.storagePath,
            signedDataUrl: data.signedUrl,
            expiresInSeconds: 60,
          });
          return;
        }
      }

      const res = await fetch(`/api/admin/documents/${doc.id}/view`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setViewingDocument(data);
      }
    } catch (e) {
      console.error('Error loading private KYC document:', e);
    }
  };

  // Bulk Shortlist / Reject (#20)
  const handleBulkStatus = async (status: 'SHORTLISTED' | 'REJECTED', reason?: string) => {
    if (!token || selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/admin/applications/bulk-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationIds: selectedIds,
          status,
          rejectionReason: reason,
          performedBy: `${admin?.name || 'Admin'} (${admin?.role || 'ADMIN'})`,
        }),
      });
      if (res.ok) {
        showToast(
          `Updated ${selectedIds.length} application(s) to ${status}`
        );
        setSelectedIds([]);
        setShowBulkRejectModal(false);
        await fetchApplications(true);
      }
    } catch (e) {
      console.error('Bulk update error:', e);
    }
  };

  // Export to Excel / CSV (#21: Do NOT export sensitive KYC documents or Aadhaar/bank info)
  const handleExportCsv = (onlySelected = false) => {
    const sourceRows = onlySelected
      ? filteredApplications.filter((a) => selectedIds.includes(a.id))
      : filteredApplications;

    const headers = [
      'Application ID',
      'Name',
      'Position',
      'Mobile',
      'Email',
      'District',
      'State',
      'Qualification',
      'Experience',
      'Expected Salary',
      'Status',
      'KYC Status',
      'Applied Date',
    ];

    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

    const csvLines = [
      headers.join(','),
      ...sourceRows.map((row) =>
        [
          escapeCsv(row.applicationNumber),
          escapeCsv(row.fullName),
          escapeCsv(row.appliedPosition),
          escapeCsv(row.mobile),
          escapeCsv(row.email || ''),
          escapeCsv(row.district),
          escapeCsv(row.state),
          escapeCsv(row.highestQualification),
          escapeCsv(`${row.experience} (${row.totalExperience})`),
          escapeCsv(row.expectedSalary),
          escapeCsv(row.status),
          escapeCsv(row.kycStatus),
          escapeCsv(new Date(row.createdAt).toLocaleDateString()),
        ].join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Doorbly_Applicants_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${sourceRows.length} non-sensitive applicant records to CSV`);
  };

  return (
    <div className="min-h-dvh w-full flex bg-slate-100 text-slate-900 overflow-x-hidden">
      {/* Mobile / Tablet Navigation Drawer Overlay (< lg) */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="w-64 max-w-[82vw] bg-slate-900 text-slate-200 flex flex-col justify-between h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {!logoError && (
                    <img
                      src={DOORBLY_LOGO_URL}
                      alt="Doorbly Logo"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoError(true)}
                      className="h-7 w-auto object-contain rounded bg-white p-0.5 shrink-0"
                    />
                  )}
                  <div>
                    <div className="text-sm font-bold tracking-tight text-white">
                      DOORBLY ADMIN
                    </div>
                    <div className="text-[11px] font-mono text-teal-400">
                      {admin?.role || 'ADMIN'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('spreadsheet');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                    activeNav === 'spreadsheet'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Applicant Spreadsheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('roles');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                    activeNav === 'roles'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Admin Roles &amp; Access</span>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 space-y-3">
              <div className="text-xs">
                <div className="font-semibold text-white truncate">
                  {admin?.name || 'Administrator'}
                </div>
                <div className="text-slate-400 font-mono truncate">{admin?.email}</div>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onNavigateToApply();
                  }}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer"
                >
                  Open Applicant Portal
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Left Workspace Sidebar (Desktop lg+) */}
      <aside className="w-60 bg-slate-900 text-slate-200 flex-col justify-between shrink-0 hidden lg:flex">
        <div>
          <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {!logoError && (
                <img
                  src={DOORBLY_LOGO_URL}
                  alt="Doorbly Logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-7 w-auto object-contain rounded bg-white p-0.5 shrink-0"
                />
              )}
              <span className="text-sm font-bold tracking-tight text-white truncate">
                DOORBLY ADMIN
              </span>
            </div>
            <span className="text-[11px] font-mono text-teal-400 shrink-0">
              {admin?.role || 'ADMIN'}
            </span>
          </div>

          <div className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => setActiveNav('spreadsheet')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                activeNav === 'spreadsheet'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Applicant Spreadsheet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('roles')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                activeNav === 'roles'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Admin Roles &amp; Access</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs">
            <div className="font-semibold text-white truncate">
              {admin?.name || 'Administrator'}
            </div>
            <div className="text-slate-400 font-mono truncate">{admin?.email}</div>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onNavigateToApply}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer"
            >
              Open Applicant Portal
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full py-2 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-600 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            {!logoError && (
              <img
                src={DOORBLY_LOGO_URL}
                alt="Doorbly Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-6 w-auto object-contain shrink-0 lg:hidden"
              />
            )}
            <span className="font-bold text-slate-900 truncate">Doorbly Console</span>
            <span className="hidden sm:inline">/</span>
            <span className="hidden sm:inline font-medium text-slate-800 truncate">
              {activeNav === 'spreadsheet'
                ? 'Applicant Spreadsheet'
                : 'Admin User Roles & Permissions'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => fetchApplications(false)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportCsv(false)}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 bg-slate-900 text-white px-4 py-3 rounded-lg border border-slate-700 text-xs font-medium flex items-center gap-2 shadow-lg">
            <Check className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {activeNav === 'spreadsheet' ? (
          <main className="p-3 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
            {/* Top Summary Cards (#14: 7 cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setKycFilter('ALL');
                }}
                className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-slate-400 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-slate-500 truncate">Total Applications</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.total}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('SUBMITTED')}
                className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-sky-400 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-sky-700 font-medium truncate">New Applications</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.submitted}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('UNDER_REVIEW')}
                className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-amber-400 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-amber-700 font-medium truncate">Under Review</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.underReview}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('SHORTLISTED')}
                className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-indigo-400 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-indigo-700 font-medium truncate">Shortlisted</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.shortlisted}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('SELECTED')}
                className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-emerald-400 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-emerald-700 font-medium truncate">Selected</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.selected}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('REJECTED')}
                className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-rose-400 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-rose-700 font-medium truncate">Rejected</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.rejected}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setKycFilter('PENDING')}
                className="col-span-2 sm:col-span-1 bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 text-left hover:border-amber-500 transition-colors cursor-pointer"
              >
                <div className="text-[11px] sm:text-xs text-amber-800 font-medium truncate">Pending KYC</div>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {summaryStats.pendingKyc}
                </div>
              </button>
            </div>

            {/* Filters & Search Bar (#14) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
                {/* Search Input */}
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search ID, Name, Mobile or Email..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>

                {/* Position Filter */}
                <select
                  value={positionFilter}
                  onChange={(e) => {
                    setPositionFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All Positions</option>
                  {DOORBLY_POSITIONS.map((p) => (
                    <option key={p.id} value={p.title}>
                      {p.title}
                    </option>
                  ))}
                </select>

                {/* District Filter */}
                <select
                  value={districtFilter}
                  onChange={(e) => {
                    setDistrictFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All Districts</option>
                  {uniqueDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {/* State Filter */}
                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All States</option>
                  {uniqueStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Application Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All App Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="SELECTED">Selected</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>

                {/* KYC Status Filter */}
                <select
                  value={kycFilter}
                  onChange={(e) => {
                    setKycFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">All KYC Statuses</option>
                  <option value="PENDING">Pending KYC</option>
                  <option value="VERIFIED">Verified KYC</option>
                  <option value="REJECTED">Rejected KYC</option>
                </select>
              </div>

              {/* Date Range & Active Bulk Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-600">
                  <span>Date Range:</span>
                  <input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                  {(searchQuery ||
                    positionFilter !== 'ALL' ||
                    districtFilter !== 'ALL' ||
                    stateFilter !== 'ALL' ||
                    statusFilter !== 'ALL' ||
                    kycFilter !== 'ALL' ||
                    dateFromFilter ||
                    dateToFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPositionFilter('ALL');
                        setDistrictFilter('ALL');
                        setStateFilter('ALL');
                        setStatusFilter('ALL');
                        setKycFilter('ALL');
                        setDateFromFilter('');
                        setDateToFilter('');
                      }}
                      className="text-teal-700 hover:underline font-medium ml-2 cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>

                {/* Bulk Actions Toolbar (#20) */}
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg">
                    <span className="font-mono font-semibold">
                      {selectedIds.length} Selected
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBulkStatus('SHORTLISTED')}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold cursor-pointer"
                    >
                      Bulk Shortlist
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBulkRejectModal(true)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 rounded text-xs font-semibold cursor-pointer"
                    >
                      Bulk Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportCsv(true)}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 rounded text-xs font-semibold cursor-pointer"
                    >
                      Bulk Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-slate-300 hover:text-white ml-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* EXCEL-STYLE APPLICANT TABLE (#15) */}
            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[62vh]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold select-none">
                    <tr className="divide-x divide-slate-300">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            paginatedApplications.length > 0 &&
                            paginatedApplications.every((a) => selectedIds.includes(a.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(paginatedApplications.map((a) => a.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                          className="accent-teal-700 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-12 text-center font-mono">S.No</th>
                      <th
                        onClick={() => toggleSort('applicationNumber')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Application ID</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => toggleSort('fullName')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Applicant Name</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => toggleSort('appliedPosition')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Position</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Mobile</th>
                      <th
                        onClick={() => toggleSort('district')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>District</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Qualification</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Experience</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-right">
                        Expected Salary
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap">KYC Status</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Application Status</th>
                      <th
                        onClick={() => toggleSort('createdAt')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Applied Date</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="divide-x divide-slate-200 animate-pulse">
                          <td colSpan={14} className="py-3 px-4 bg-slate-50 text-slate-400">
                            Loading spreadsheet row...
                          </td>
                        </tr>
                      ))
                    ) : paginatedApplications.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-12 text-center text-slate-500">
                          No applicant records match your current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedApplications.map((app, idx) => {
                        const serialNo = (currentPage - 1) * pageSize + idx + 1;
                        const statusCfg =
                          APPLICATION_STATUS_CONFIG[app.status] ||
                          APPLICATION_STATUS_CONFIG.SUBMITTED;
                        const kycCfg =
                          KYC_STATUS_CONFIG[app.kycStatus] || KYC_STATUS_CONFIG.PENDING;

                        return (
                          <tr
                            key={app.id}
                            onClick={() => openApplicantDetails(app.id)}
                            className="divide-x divide-slate-200 hover:bg-teal-50/40 transition-colors cursor-pointer"
                          >
                            <td
                              className="py-2 px-3 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(app.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedIds((prev) => [...prev, app.id]);
                                  } else {
                                    setSelectedIds((prev) =>
                                      prev.filter((id) => id !== app.id)
                                    );
                                  }
                                }}
                                className="accent-teal-700 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-500 bg-slate-50/60">
                              {serialNo}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold text-teal-800 whitespace-nowrap">
                              {app.applicationNumber}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              {app.fullName}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {app.appliedPosition}
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {app.mobile}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {app.district}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap max-w-[160px] truncate">
                              {app.highestQualification}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {app.experience} ({app.totalExperience})
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-800 whitespace-nowrap">
                              {app.expectedSalary}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${kycCfg.bgColor} ${kycCfg.textColor}`}
                              >
                                {kycCfg.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${statusCfg.bgColor} ${statusCfg.textColor} ${statusCfg.borderColor}`}
                              >
                                {statusCfg.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {new Date(app.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td
                              className="py-2 px-3 text-center whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => openApplicantDetails(app.id)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-teal-700 text-white rounded text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Review</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Spreadsheet Footer & Pagination (#15) */}
              <div className="bg-slate-50 border-t border-slate-300 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="font-mono tabular-nums">
                  Showing{' '}
                  <strong>
                    {filteredApplications.length === 0
                      ? 0
                      : (currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong>
                    {Math.min(currentPage * pageSize, filteredApplications.length)}
                  </strong>{' '}
                  of <strong>{filteredApplications.length}</strong> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 border border-slate-300 rounded bg-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 border border-slate-300 rounded bg-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </main>
        ) : (
          /* ADMIN USER ROLES MANAGEMENT VIEW (#25) */
          <main className="p-3 sm:p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">
                Administrator Profiles &amp; Role-Based Access Control
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage administrator permissions for candidate screening, KYC verification, and exports.
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Permissions Summary</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {adminUsersList.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 px-3 font-semibold text-slate-900">{u.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                        <td className="py-3 px-3">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              if (!token) return;
                              await fetch(`/api/admin/users/${u.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  role: e.target.value,
                                  active: u.active,
                                }),
                              });
                              fetchAdminUsers();
                              showToast(`Updated role for ${u.name}`);
                            }}
                            className="border border-slate-300 rounded px-2 py-1 text-xs font-mono font-semibold bg-white"
                          >
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="HR">HR</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {u.role === 'SUPER_ADMIN'
                            ? 'Full access to applications, KYC verification, exports & admin roles'
                            : u.role === 'ADMIN'
                            ? 'View, review, shortlist, select/reject and export applications'
                            : 'View applications, review KYC documents and manage recruitment status'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-emerald-700 font-semibold">Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* APPLICANT DETAILS SIDE PANEL / DRAWER (#16, #17, #18, #19, #22, #23) */}
      {(activeApplicant || loadingDetails) && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-3xl h-dvh flex flex-col border-l border-slate-200 overflow-hidden shadow-2xl">
            {loadingDetails || !activeApplicant ? (
              <div className="p-8 text-center text-sm text-slate-500 my-auto">
                Loading candidate profile and KYC verification records...
              </div>
            ) : (
              <>
                {/* Drawer Header */}
                <div className="px-4 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-mono text-teal-400">
                      <span>{activeApplicant.applicationNumber}</span>
                      <span>·</span>
                      <span className="truncate">Applied for {activeApplicant.appliedPosition}</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white mt-0.5 truncate">
                      {activeApplicant.fullName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveApplicant(null)}
                    className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 sm:space-y-6 text-xs">
                  {/* Status Pipeline & Select / Reject Controls (#18, #19) */}
                  <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-slate-500 font-medium">
                          Current Application &amp; KYC Status
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                          <span className="font-bold text-sm text-slate-900">
                            Status: {activeApplicant.status}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-sm text-teal-800">
                            KYC: {activeApplicant.kycStatus}
                          </span>
                        </div>
                        {activeApplicant.reviewedBy && (
                          <div className="text-slate-500 mt-1">
                            Last reviewed by <strong>{activeApplicant.reviewedBy}</strong> on{' '}
                            {activeApplicant.reviewedAt
                              ? new Date(activeApplicant.reviewedAt).toLocaleString()
                              : 'N/A'}
                          </div>
                        )}
                        {activeApplicant.rejectionReason && (
                          <div className="text-rose-700 font-semibold mt-1">
                            Rejection Reason: {activeApplicant.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Primary Select / Reject Candidate Buttons (#18) */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSelectConfirmModal(true)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap text-center"
                        >
                          SELECT CANDIDATE
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRejectModal(true)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap text-center"
                        >
                          REJECT CANDIDATE
                        </button>
                      </div>
                    </div>

                    {/* Stage Transition Pipeline (#19: SUBMITTED -> UNDER_REVIEW -> SHORTLISTED -> SELECTED + ON_HOLD) */}
                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                      <span className="text-slate-600 font-semibold mr-1">
                        Move Pipeline Stage:
                      </span>
                      {(
                        [
                          'SUBMITTED',
                          'UNDER_REVIEW',
                          'SHORTLISTED',
                          'ON_HOLD',
                        ] as const
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusUpdate(activeApplicant.id, st)}
                          className={`px-2.5 py-1 rounded border font-semibold transition-colors cursor-pointer ${
                            activeApplicant.status === st
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Applicant Personal, Position, Education & Emergency Information (#16) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                      <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                        Personal &amp; Residential Details
                      </h3>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Full Name:</span>
                        <span className="col-span-2 font-semibold text-slate-900">
                          {activeApplicant.fullName}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Parent Name:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.parentName}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">DOB / Gender:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.dateOfBirth} · {activeApplicant.gender}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Mobile:</span>
                        <span className="col-span-2 font-mono font-semibold text-slate-900">
                          {activeApplicant.mobile}
                          {activeApplicant.alternateMobile
                            ? ` / ${activeApplicant.alternateMobile}`
                            : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Email:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.email || 'Not provided'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Address:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.address}, {activeApplicant.district},{' '}
                          {activeApplicant.state} - {activeApplicant.pinCode}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                      <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                        Professional, Academic &amp; Emergency Info
                      </h3>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Position:</span>
                        <span className="col-span-2 font-semibold text-teal-800">
                          {activeApplicant.appliedPosition}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Pref. Location:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.preferredLocation}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Experience:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.experience} ({activeApplicant.totalExperience})
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Past Company:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.previousCompany || 'N/A'}{' '}
                          {activeApplicant.previousDesignation
                            ? `(${activeApplicant.previousDesignation})`
                            : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Expected Pay:</span>
                        <span className="col-span-2 font-mono font-semibold text-slate-900">
                          {activeApplicant.expectedSalary} · Notice: {activeApplicant.noticePeriod}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Education:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.highestQualification} — {activeApplicant.institution} (
                          {activeApplicant.passingYear})
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-500">Skills:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.skills}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Emergency:</span>
                        <span className="col-span-2 text-slate-800">
                          {activeApplicant.emergencyContactName} (
                          {activeApplicant.emergencyContactRelationship}) ·{' '}
                          <span className="font-mono">
                            {activeApplicant.emergencyContactMobile}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KYC DOCUMENTS & VERIFICATION SECTION (#16, #17) */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          KYC Verification Documents
                        </h3>
                        <p className="text-xs text-slate-500">
                          Review and verify uploaded candidate identity and qualification documents.
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {activeApplicant.documents?.length || 0} Document(s)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                      {(activeApplicant.documents || []).map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">
                                {doc.documentType}
                              </span>
                              <span>·</span>
                              <span
                                className={`font-semibold ${
                                  doc.verificationStatus === 'VERIFIED'
                                    ? 'text-emerald-700'
                                    : doc.verificationStatus === 'REJECTED'
                                    ? 'text-rose-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {doc.verificationStatus}
                              </span>
                            </div>
                            <div className="text-slate-600 font-mono text-xs">
                              {doc.fileName}
                            </div>
                            {doc.remarks && (
                              <div className="text-slate-500 italic">
                                Note: {doc.remarks}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSecureViewDocument(doc)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-teal-700" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDocumentVerification(
                                  doc.id,
                                  'VERIFIED',
                                  'Document verified by administrator'
                                )
                              }
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Verify</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRejectingDocId(doc.id);
                                setDocRejectReason('Document is unclear');
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inline Document Rejection Reason Prompt (#17) */}
                    {rejectingDocId && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
                        <div className="font-bold text-rose-900">
                          Specify Document Rejection Reason (Required)
                        </div>
                        <input
                          type="text"
                          value={docRejectReason}
                          onChange={(e) => setDocRejectReason(e.target.value)}
                          placeholder="Reason: Document is unclear"
                          className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!docRejectReason.trim()) return;
                              handleDocumentVerification(
                                rejectingDocId,
                                'REJECTED',
                                `Reason: ${docRejectReason.trim()}`
                              );
                            }}
                            className="px-3.5 py-1.5 bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
                          >
                            Confirm Document Rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingDocId(null)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* INTERNAL ADMIN REMARKS (#22) */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm">
                      Internal Administrator Remarks (Visible only to authorized admins)
                    </h3>
                    <textarea
                      rows={2}
                      value={remarkDraft}
                      onChange={(e) => setRemarkDraft(e.target.value)}
                      placeholder="e.g., Good communication skills. Shortlist for interview."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-teal-700"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          activeApplicant.id,
                          undefined,
                          undefined,
                          remarkDraft
                        )
                      }
                      className="px-4 py-2 bg-slate-900 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Save Internal Remark
                    </button>
                  </div>

                  {/* AUDIT LOG (#23) */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-teal-700" />
                      <span>Application Activity &amp; Audit History</span>
                    </h3>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(activeApplicant.activityLogs || []).map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-4"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {log.action}
                              {log.newStatus ? ` → ${log.newStatus}` : ''}
                            </div>
                            {log.remarks && (
                              <div className="text-slate-600 mt-0.5">{log.remarks}</div>
                            )}
                            <div className="text-slate-400 mt-0.5">
                              By: {log.performedBy}
                            </div>
                          </div>
                          <div className="font-mono text-slate-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SELECT CANDIDATE CONFIRMATION MODAL (#18) */}
      {showSelectConfirmModal && activeApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Candidate Selection
            </h3>
            <p className="text-sm text-slate-700">
              Are you sure you want to select this candidate?
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <strong>Candidate:</strong> {activeApplicant.fullName} (
                {activeApplicant.applicationNumber})
              </div>
              <div>
                <strong>Position:</strong> {activeApplicant.appliedPosition}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSelectConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleStatusUpdate(activeApplicant.id, 'SELECTED');
                  setShowSelectConfirmModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                Confirm &amp; Set SELECTED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT CANDIDATE MODAL (#18) */}
      {showRejectModal && activeApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Reject Candidate Application
            </h3>
            <p className="text-xs text-slate-600">
              Select a mandatory rejection reason for{' '}
              <strong>{activeApplicant.fullName}</strong>:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Rejection Reason *
              </label>
              <select
                value={rejectionReasonSelect}
                onChange={(e) => setRejectionReasonSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {rejectionReasonSelect === 'Other' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specify Other Reason *
                </label>
                <input
                  type="text"
                  value={customRejectionText}
                  onChange={(e) => setCustomRejectionText(e.target.value)}
                  placeholder="Enter detailed rejection reason"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const finalReason =
                    rejectionReasonSelect === 'Other'
                      ? customRejectionText.trim() || 'Other'
                      : rejectionReasonSelect;
                  await handleStatusUpdate(
                    activeApplicant.id,
                    'REJECTED',
                    finalReason
                  );
                  setShowRejectModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK REJECT CONFIRMATION MODAL (#20) */}
      {showBulkRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Bulk Rejection ({selectedIds.length} Applicants)
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to reject the {selectedIds.length} selected applications? Please select the rejection reason:
            </p>
            <select
              value={bulkRejectionReason}
              onChange={(e) => setBulkRejectionReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBulkStatus('REJECTED', bulkRejectionReason)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Reject {selectedIds.length} Applicants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATED PRIVATE KYC DOCUMENT VIEWER MODAL (#16) */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-teal-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Official KYC Document Viewer</span>
                </div>
                <div className="text-sm font-bold mt-0.5">
                  {viewingDocument.documentType} — {viewingDocument.fileName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded cursor-pointer"
              >
                Close Viewer
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex-1 overflow-auto flex items-center justify-center">
              {viewingDocument.signedDataUrl ? (
                viewingDocument.signedDataUrl.startsWith('data:application/pdf') ? (
                  <iframe
                    src={viewingDocument.signedDataUrl}
                    title={viewingDocument.fileName}
                    className="w-full h-[65vh] bg-white rounded border border-slate-300"
                  />
                ) : (
                  <img
                    src={viewingDocument.signedDataUrl}
                    alt={viewingDocument.fileName}
                    className="max-w-full max-h-[65vh] object-contain rounded border border-slate-300 bg-white"
                  />
                )
              ) : (
                <div className="p-8 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-600">
                  Document preview unavailable.
                </div>
              )}
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">{viewingDocument.fileName}</span>
              <span>Confidential Candidate Verification Document</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
