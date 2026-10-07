import { supabase, isSupabaseConfigured, KYC_STORAGE_BUCKET } from './supabase.ts';

const LOCAL_APPLICATIONS_KEY = 'doorbly_production_applications_v1';
const LOCAL_ADMIN_USERS_KEY = 'doorbly_production_admin_users_v1';

// Helper to parse JSON safely without throwing SyntaxError on Vercel 404 HTML responses
async function safeParseJson(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getLocalApplications(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_APPLICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalApplications(apps: any[]) {
  try {
    localStorage.setItem(LOCAL_APPLICATIONS_KEY, JSON.stringify(apps));
  } catch (e) {
    console.error('Storage warning:', e);
  }
}

// Map snake_case Supabase row to camelCase ApplicationRecord
function mapSupabaseAppToRecord(row: any, docs: any[] = [], logs: any[] = []) {
  const mappedDocs = docs.map((d) => ({
    id: d.id,
    applicationId: d.application_id || d.applicationId,
    documentType: d.document_type || d.documentType,
    fileName: d.file_name || d.fileName,
    storagePath: d.storage_path || d.storagePath,
    fileDataUrl: d.file_data_url || d.fileDataUrl,
    mimeType: d.mime_type || d.mimeType || 'application/octet-stream',
    uploadedAt: d.uploaded_at || d.uploadedAt || new Date().toISOString(),
    verificationStatus: d.verification_status || d.verificationStatus || 'PENDING',
    verifiedBy: d.verified_by || d.verifiedBy || null,
    verifiedAt: d.verified_at || d.verifiedAt || null,
    remarks: d.remarks || null,
  }));

  const mappedLogs = logs.map((l) => ({
    id: l.id,
    applicationId: l.application_id || l.applicationId,
    action: l.action,
    oldStatus: l.old_status ?? l.oldStatus ?? null,
    newStatus: l.new_status ?? l.newStatus ?? null,
    remarks: l.remarks ?? null,
    performedBy: l.performed_by || l.performedBy || 'Administrator',
    createdAt: l.created_at || l.createdAt || new Date().toISOString(),
  }));

  let kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'PENDING';
  if (mappedDocs.length > 0) {
    if (mappedDocs.some((d) => d.verificationStatus === 'REJECTED')) {
      kycStatus = 'REJECTED';
    } else if (mappedDocs.every((d) => d.verificationStatus === 'VERIFIED')) {
      kycStatus = 'VERIFIED';
    }
  }

  return {
    id: row.id,
    applicationNumber: row.application_number || row.applicationNumber,
    fullName: row.full_name || row.fullName,
    parentName: row.parent_name || row.parentName,
    dateOfBirth: row.date_of_birth || row.dateOfBirth,
    gender: row.gender,
    mobile: row.mobile,
    alternateMobile: row.alternate_mobile ?? row.alternateMobile ?? null,
    email: row.email ?? null,
    address: row.address,
    district: row.district,
    state: row.state,
    pinCode: row.pin_code || row.pinCode,
    appliedPosition: row.applied_position || row.appliedPosition,
    preferredLocation: row.preferred_location || row.preferredLocation,
    experience: row.experience,
    totalExperience: row.total_experience || row.totalExperience,
    previousCompany: row.previous_company ?? row.previousCompany ?? null,
    previousDesignation: row.previous_designation ?? row.previousDesignation ?? null,
    expectedSalary: row.expected_salary || row.expectedSalary,
    noticePeriod: row.notice_period || row.noticePeriod,
    highestQualification: row.highest_qualification || row.highestQualification,
    institution: row.institution,
    passingYear: row.passing_year || row.passingYear,
    additionalQualifications:
      row.additional_qualifications ?? row.additionalQualifications ?? null,
    skills: row.skills,
    emergencyContactName: row.emergency_contact_name || row.emergencyContactName,
    emergencyContactRelationship:
      row.emergency_contact_relationship || row.emergencyContactRelationship,
    emergencyContactMobile: row.emergency_contact_mobile || row.emergencyContactMobile,
    status: row.status || 'SUBMITTED',
    kycStatus: row.kycStatus || kycStatus,
    adminRemarks: row.admin_remarks ?? row.adminRemarks ?? null,
    rejectionReason: row.rejection_reason ?? row.rejectionReason ?? null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? null,
    documents: mappedDocs,
    activityLogs: mappedLogs,
  };
}

// 1. Check Duplicate Application
export async function apiCheckDuplicate(
  mobile: string,
  email: string,
  appliedPosition: string
): Promise<{ duplicate: boolean; message?: string }> {
  // Try backend Express API first
  try {
    const res = await fetch('/api/applications/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, email, appliedPosition }),
    });
    const data = await safeParseJson(res);
    if (data && (res.ok || res.status === 409)) {
      return {
        duplicate: Boolean(data.duplicate || res.status === 409),
        message: data.message,
      };
    }
  } catch {
    // Fallback to direct Supabase or client store
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: rows } = await supabase
        .from('job_applications')
        .select('id, status, mobile, email, applied_position')
        .eq('applied_position', appliedPosition.trim());

      if (rows && rows.length > 0) {
        const cleanMob = mobile.trim();
        const cleanEm = email.trim().toLowerCase();
        const dup = rows.find(
          (r: any) =>
            r.status !== 'REJECTED' &&
            (r.mobile === cleanMob || (cleanEm && (r.email || '').toLowerCase() === cleanEm))
        );
        if (dup) {
          return {
            duplicate: true,
            message:
              'An application already exists with these details. Please contact Doorbly recruitment support if you need to update your application.',
          };
        }
      }
    } catch {
      // ignore if anon SELECT is restricted by RLS
    }
  }

  const localApps = getLocalApplications();
  const cleanMob = mobile.trim();
  const cleanEm = email.trim().toLowerCase();
  const localDup = localApps.find(
    (a) =>
      a.appliedPosition === appliedPosition.trim() &&
      a.status !== 'REJECTED' &&
      (a.mobile === cleanMob || (cleanEm && (a.email || '').toLowerCase() === cleanEm))
  );

  if (localDup) {
    return {
      duplicate: true,
      message:
        'An application already exists with these details. Please contact Doorbly recruitment support if you need to update your application.',
    };
  }

  return { duplicate: false };
}

// 2. Submit New Application + KYC Documents
export async function apiSubmitApplication(payload: any): Promise<{
  id: string;
  applicationNumber: string;
  status: string;
  createdAt: string;
}> {
  // Try backend Express API first
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await safeParseJson(res);
    if (data) {
      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to submit application. Please review your details and try again.'
        );
      }
      return data;
    }
  } catch (err: any) {
    // If the backend explicitly returned a 400/409 validation error message, rethrow it
    if (err?.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
  }

  const year = new Date().getFullYear();
  const localApps = getLocalApplications();
  const nextSeq = String(localApps.length + 1).padStart(6, '0');
  const generatedAppNumber = `DB-${year}-${nextSeq}`;
  const appId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();

  // Try direct Supabase PostgreSQL insert if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: insertedApp, error: appErr } = await supabase
        .from('job_applications')
        .insert({
          id: appId,
          application_number: generatedAppNumber,
          full_name: payload.fullName.trim(),
          parent_name: payload.parentName.trim(),
          date_of_birth: payload.dateOfBirth,
          gender: payload.gender,
          mobile: payload.mobile.trim(),
          alternate_mobile: payload.alternateMobile?.trim() || null,
          email: payload.email?.trim().toLowerCase() || null,
          address: payload.address.trim(),
          district: payload.district.trim(),
          state: payload.state.trim(),
          pin_code: payload.pinCode.trim(),
          applied_position: payload.appliedPosition,
          preferred_location: payload.preferredLocation.trim(),
          experience: payload.experience,
          total_experience: payload.totalExperience.trim(),
          previous_company: payload.previousCompany?.trim() || null,
          previous_designation: payload.previousDesignation?.trim() || null,
          expected_salary: payload.expectedSalary.trim(),
          notice_period: payload.noticePeriod.trim(),
          highest_qualification: payload.highestQualification.trim(),
          institution: payload.institution.trim(),
          passing_year: payload.passingYear.trim(),
          additional_qualifications: payload.additionalQualifications?.trim() || null,
          skills: payload.skills.trim(),
          emergency_contact_name: payload.emergencyContactName.trim(),
          emergency_contact_relationship: payload.emergencyContactRelationship.trim(),
          emergency_contact_mobile: payload.emergencyContactMobile.trim(),
          status: 'SUBMITTED',
        })
        .select()
        .single();

      const finalAppId = insertedApp?.id || appId;
      const finalAppNum = insertedApp?.application_number || generatedAppNumber;

      if (!appErr) {
        if (Array.isArray(payload.documents) && payload.documents.length > 0) {
          await supabase.from('candidate_documents').insert(
            payload.documents.map((doc: any) => ({
              application_id: finalAppId,
              document_type: doc.documentType,
              file_name: doc.fileName,
              storage_path: doc.storagePath,
              verification_status: 'PENDING',
            }))
          );
        }

        await supabase.from('application_activity_logs').insert({
          application_id: finalAppId,
          action: 'Application submitted',
          old_status: null,
          new_status: 'SUBMITTED',
          remarks: `Application ${finalAppNum} submitted for ${payload.appliedPosition}.`,
          performed_by: 'Applicant (Self)',
        });

        return {
          id: finalAppId,
          applicationNumber: finalAppNum,
          status: 'SUBMITTED',
          createdAt: nowIso,
        };
      }
    } catch (supaErr) {
      console.error('Supabase direct insert warning:', supaErr);
    }
  }

  // Fallback to persistent local storage so Vercel static deployments work seamlessly out-of-the-box
  const docsRecord = (payload.documents || []).map((doc: any, idx: number) => ({
    id: `doc-${Date.now()}-${idx}`,
    applicationId: appId,
    documentType: doc.documentType,
    fileName: doc.fileName,
    storagePath: doc.storagePath,
    fileDataUrl: doc.fileDataUrl,
    mimeType: doc.mimeType || 'application/octet-stream',
    uploadedAt: nowIso,
    verificationStatus: 'PENDING',
    verifiedBy: null,
    verifiedAt: null,
    remarks: null,
  }));

  const initialLog = {
    id: `log-${Date.now()}-1`,
    applicationId: appId,
    action: 'Application submitted',
    oldStatus: null,
    newStatus: 'SUBMITTED',
    remarks: `Application ${generatedAppNumber} submitted for ${payload.appliedPosition} with ${docsRecord.length} KYC document(s).`,
    performedBy: 'Applicant (Self)',
    createdAt: nowIso,
  };

  const newRecord = {
    id: appId,
    applicationNumber: generatedAppNumber,
    fullName: payload.fullName.trim(),
    parentName: payload.parentName.trim(),
    dateOfBirth: payload.dateOfBirth,
    gender: payload.gender,
    mobile: payload.mobile.trim(),
    alternateMobile: payload.alternateMobile?.trim() || null,
    email: payload.email?.trim().toLowerCase() || null,
    address: payload.address.trim(),
    district: payload.district.trim(),
    state: payload.state.trim(),
    pinCode: payload.pinCode.trim(),
    appliedPosition: payload.appliedPosition,
    preferredLocation: payload.preferredLocation.trim(),
    experience: payload.experience,
    totalExperience: payload.totalExperience.trim(),
    previousCompany: payload.previousCompany?.trim() || null,
    previousDesignation: payload.previousDesignation?.trim() || null,
    expectedSalary: payload.expectedSalary.trim(),
    noticePeriod: payload.noticePeriod.trim(),
    highestQualification: payload.highestQualification.trim(),
    institution: payload.institution.trim(),
    passingYear: payload.passingYear.trim(),
    additionalQualifications: payload.additionalQualifications?.trim() || null,
    skills: payload.skills.trim(),
    emergencyContactName: payload.emergencyContactName.trim(),
    emergencyContactRelationship: payload.emergencyContactRelationship.trim(),
    emergencyContactMobile: payload.emergencyContactMobile.trim(),
    status: 'SUBMITTED',
    kycStatus: 'PENDING',
    adminRemarks: null,
    rejectionReason: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    reviewedAt: null,
    reviewedBy: null,
    documents: docsRecord,
    activityLogs: [initialLog],
  };

  saveLocalApplications([newRecord, ...localApps]);

  return {
    id: newRecord.id,
    applicationNumber: newRecord.applicationNumber,
    status: newRecord.status,
    createdAt: newRecord.createdAt,
  };
}

// 3. List All Applications for Admin
export async function apiListApplications(token: string): Promise<any[]> {
  try {
    const res = await fetch('/api/admin/applications', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await safeParseJson(res);
    if (res.ok && data && Array.isArray(data.applications)) {
      return data.applications;
    }
  } catch {
    // Fallback
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: apps, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && apps) {
        const { data: docs } = await supabase.from('candidate_documents').select('*');
        const docsByApp = new Map<string, any[]>();
        (docs || []).forEach((d: any) => {
          const list = docsByApp.get(d.application_id) || [];
          list.push(d);
          docsByApp.set(d.application_id, list);
        });

        const supaRecords = apps.map((a: any) =>
          mapSupabaseAppToRecord(a, docsByApp.get(a.id) || [])
        );
        const localApps = getLocalApplications();
        const combined = [...supaRecords];
        for (const loc of localApps) {
          if (!combined.some((r) => r.applicationNumber === loc.applicationNumber)) {
            combined.push(loc);
          }
        }
        return combined;
      }
    } catch {
      // Fallback
    }
  }

  return getLocalApplications();
}

// 4. Get Single Application Details for Admin
export async function apiGetApplicationDetails(appId: string, token: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/admin/applications/${appId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await safeParseJson(res);
    if (res.ok && data?.application) {
      return data.application;
    }
  } catch {
    // Fallback
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: app } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', appId)
        .single();
      if (app) {
        const { data: docs } = await supabase
          .from('candidate_documents')
          .select('*')
          .eq('application_id', appId);
        const { data: logs } = await supabase
          .from('application_activity_logs')
          .select('*')
          .eq('application_id', appId)
          .order('created_at', { ascending: false });
        return mapSupabaseAppToRecord(app, docs || [], logs || []);
      }
    } catch {
      // Fallback
    }
  }

  const localApps = getLocalApplications();
  return localApps.find((a) => a.id === appId) || null;
}

// 5. Update Application Status & Remarks
export async function apiUpdateApplicationStatus(
  appId: string,
  token: string,
  payload: {
    status?: string;
    rejectionReason?: string;
    adminRemarks?: string;
    performedBy: string;
  }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/applications/${appId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await safeParseJson(res);
    if (res.ok && data) return true;
  } catch {
    // Fallback
  }

  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const updateObj: any = {
        updated_at: nowIso,
        reviewed_at: nowIso,
        reviewed_by: payload.performedBy,
      };
      if (payload.status !== undefined) updateObj.status = payload.status;
      if (payload.adminRemarks !== undefined) updateObj.admin_remarks = payload.adminRemarks;
      if (payload.rejectionReason !== undefined) updateObj.rejection_reason = payload.rejectionReason;

      const { error } = await supabase
        .from('job_applications')
        .update(updateObj)
        .eq('id', appId);

      if (!error) {
        await supabase.from('application_activity_logs').insert({
          application_id: appId,
          action: payload.status ? `Status updated to ${payload.status}` : 'Admin remark saved',
          new_status: payload.status || null,
          remarks: payload.rejectionReason || payload.adminRemarks || null,
          performed_by: payload.performedBy,
        });
        return true;
      }
    } catch {
      // Fallback
    }
  }

  const localApps = getLocalApplications();
  const updated = localApps.map((app) => {
    if (app.id !== appId) return app;
    const oldStatus = app.status;
    const nextStatus = payload.status ?? app.status;
    const logEntry = {
      id: `log-${Date.now()}`,
      applicationId: appId,
      action: payload.status ? `Status updated` : 'Admin remark updated',
      oldStatus,
      newStatus: nextStatus,
      remarks: payload.rejectionReason || payload.adminRemarks || `Status set to ${nextStatus}`,
      performedBy: payload.performedBy,
      createdAt: nowIso,
    };
    return {
      ...app,
      status: nextStatus,
      adminRemarks: payload.adminRemarks !== undefined ? payload.adminRemarks : app.adminRemarks,
      rejectionReason:
        payload.rejectionReason !== undefined ? payload.rejectionReason : app.rejectionReason,
      updatedAt: nowIso,
      reviewedAt: nowIso,
      reviewedBy: payload.performedBy,
      activityLogs: [logEntry, ...(app.activityLogs || [])],
    };
  });
  saveLocalApplications(updated);
  return true;
}

// 6. Verify or Reject KYC Document
export async function apiVerifyDocument(
  docId: string,
  appId: string,
  token: string,
  payload: {
    verificationStatus: 'VERIFIED' | 'REJECTED';
    remarks?: string;
    performedBy: string;
  }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/documents/${docId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await safeParseJson(res);
    if (res.ok && data) return true;
  } catch {
    // Fallback
  }

  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('candidate_documents')
        .update({
          verification_status: payload.verificationStatus,
          verified_by: payload.performedBy,
          verified_at: nowIso,
          remarks: payload.remarks || null,
        })
        .eq('id', docId);

      if (!error) {
        await supabase.from('application_activity_logs').insert({
          application_id: appId,
          action: `Document ${payload.verificationStatus}`,
          new_status: payload.verificationStatus,
          remarks: payload.remarks || null,
          performed_by: payload.performedBy,
        });
        return true;
      }
    } catch {
      // Fallback
    }
  }

  const localApps = getLocalApplications();
  const updated = localApps.map((app) => {
    if (app.id !== appId) return app;
    const nextDocs = (app.documents || []).map((d: any) =>
      d.id === docId
        ? {
            ...d,
            verificationStatus: payload.verificationStatus,
            verifiedBy: payload.performedBy,
            verifiedAt: nowIso,
            remarks: payload.remarks || null,
          }
        : d
    );
    let kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'PENDING';
    if (nextDocs.length > 0) {
      if (nextDocs.some((d: any) => d.verificationStatus === 'REJECTED')) {
        kycStatus = 'REJECTED';
      } else if (nextDocs.every((d: any) => d.verificationStatus === 'VERIFIED')) {
        kycStatus = 'VERIFIED';
      }
    }
    const logEntry = {
      id: `log-${Date.now()}`,
      applicationId: appId,
      action: `Document ${payload.verificationStatus}`,
      oldStatus: 'PENDING',
      newStatus: payload.verificationStatus,
      remarks: payload.remarks || null,
      performedBy: payload.performedBy,
      createdAt: nowIso,
    };
    return {
      ...app,
      kycStatus,
      documents: nextDocs,
      activityLogs: [logEntry, ...(app.activityLogs || [])],
    };
  });
  saveLocalApplications(updated);
  return true;
}

// 7. View Authenticated KYC Document
export async function apiViewDocument(doc: any, token: string): Promise<any | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const cleanPath = String(doc.storagePath || '').replace(/^candidate-kyc\//, '');
      const { data } = await supabase.storage
        .from(KYC_STORAGE_BUCKET)
        .createSignedUrl(cleanPath, 60);
      if (data?.signedUrl) {
        return {
          fileName: doc.fileName,
          documentType: doc.documentType,
          storagePath: doc.storagePath,
          signedDataUrl: data.signedUrl,
          expiresInSeconds: 60,
        };
      }
    } catch {
      // Fallback
    }
  }

  try {
    const res = await fetch(`/api/admin/documents/${doc.id}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await safeParseJson(res);
    if (res.ok && data) return data;
  } catch {
    // Fallback
  }

  // Check local storage document data URL
  const localApps = getLocalApplications();
  for (const app of localApps) {
    const found = (app.documents || []).find((d: any) => d.id === doc.id);
    if (found) {
      return {
        fileName: found.fileName,
        documentType: found.documentType,
        storagePath: found.storagePath,
        signedDataUrl: found.fileDataUrl || '',
        expiresInSeconds: 300,
      };
    }
  }

  return {
    fileName: doc.fileName,
    documentType: doc.documentType,
    storagePath: doc.storagePath,
    signedDataUrl: doc.fileDataUrl || '',
    expiresInSeconds: 300,
  };
}

// 8. Bulk Update Application Status
export async function apiBulkUpdateStatus(
  applicationIds: string[],
  status: 'SHORTLISTED' | 'REJECTED',
  reason: string | undefined,
  performedBy: string,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/applications/bulk-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        applicationIds,
        status,
        rejectionReason: reason,
        performedBy,
      }),
    });
    const data = await safeParseJson(res);
    if (res.ok && data) return true;
  } catch {
    // Fallback
  }

  for (const id of applicationIds) {
    await apiUpdateApplicationStatus(id, token, {
      status,
      rejectionReason: reason,
      performedBy,
    });
  }
  return true;
}

// 9. Admin Users List
export async function apiListAdminUsers(token: string): Promise<any[]> {
  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await safeParseJson(res);
    if (res.ok && data?.users) return data.users;
  } catch {
    // Fallback
  }

  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  const defaultAdmins = [
    {
      id: 'admin-super-tribune-id',
      userId: 'admin-super-tribune',
      name: 'Debabrata Mohanta',
      email: 'debabrata.tribune@gmail.com',
      role: 'SUPER_ADMIN',
      active: true,
    },
  ];
  return defaultAdmins;
}

export async function apiUpdateAdminUser(
  userId: string,
  role: string,
  active: boolean,
  token: string
): Promise<void> {
  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role, active }),
    });
    const data = await safeParseJson(res);
    if (res.ok && data) return;
  } catch {
    // Fallback
  }

  const current = await apiListAdminUsers(token);
  const updated = current.map((u) => (u.id === userId ? { ...u, role, active } : u));
  try {
    localStorage.setItem(LOCAL_ADMIN_USERS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
