import { db } from './index.ts';
import {
  adminUsers,
  jobApplications,
  candidateDocuments,
  applicationActivityLogs,
} from './schema.ts';
import { eq, desc, and, or } from 'drizzle-orm';

export async function getOrCreateAdminUser(uid: string, email: string, name?: string) {
  try {
    const displayName = name || email.split('@')[0] || 'Doorbly Administrator';
    const result = await db
      .insert(adminUsers)
      .values({
        userId: uid,
        email,
        name: displayName,
        role: 'SUPER_ADMIN',
        active: true,
      })
      .onConflictDoUpdate({
        target: adminUsers.userId,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to get or create admin user:', error);
    throw new Error('Could not verify administrator profile.', { cause: error });
  }
}

export async function getAllAdminUsers() {
  try {
    return await db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
  } catch (error) {
    console.error('Failed to fetch admin users:', error);
    throw new Error('Failed to load administrator profiles.', { cause: error });
  }
}

export async function updateAdminUserRole(id: string, role: string, active: boolean) {
  try {
    const result = await db
      .update(adminUsers)
      .set({ role, active })
      .where(eq(adminUsers.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to update admin user:', error);
    throw new Error('Failed to update administrator role.', { cause: error });
  }
}

export async function checkDuplicateApplication(
  mobile: string,
  email: string | undefined,
  appliedPosition: string
) {
  try {
    const conditions = [
      and(
        eq(jobApplications.mobile, mobile.trim()),
        eq(jobApplications.appliedPosition, appliedPosition.trim())
      ),
    ];

    if (email && email.trim() !== '') {
      conditions.push(
        and(
          eq(jobApplications.email, email.trim().toLowerCase()),
          eq(jobApplications.appliedPosition, appliedPosition.trim())
        )
      );
    }

    const existing = await db
      .select({
        id: jobApplications.id,
        status: jobApplications.status,
      })
      .from(jobApplications)
      .where(or(...conditions));

    // Active application check (if not rejected)
    const activeMatch = existing.find((app) => app.status !== 'REJECTED');
    return Boolean(activeMatch);
  } catch (error) {
    console.error('Duplicate application check failed:', error);
    throw new Error('Unable to verify application uniqueness. Please try again.', {
      cause: error,
    });
  }
}

export async function generateNextApplicationNumber(): Promise<string> {
  try {
    const allApps = await db
      .select({ applicationNumber: jobApplications.applicationNumber })
      .from(jobApplications)
      .orderBy(desc(jobApplications.createdAt));

    const year = new Date().getFullYear();
    let maxSeq = 0;
    for (const row of allApps) {
      const parts = row.applicationNumber.split('-');
      if (parts.length === 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(6, '0');
    return `DB-${year}-${nextSeq}`;
  } catch (error) {
    console.error('Error generating application number:', error);
    const randomFallback = String(Math.floor(100000 + Math.random() * 900000));
    return `DB-${new Date().getFullYear()}-${randomFallback}`;
  }
}

export interface CreateApplicationPayload {
  fullName: string;
  parentName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  alternateMobile?: string;
  email?: string;
  address: string;
  district: string;
  state: string;
  pinCode: string;
  appliedPosition: string;
  preferredLocation: string;
  experience: string;
  totalExperience: string;
  previousCompany?: string;
  previousDesignation?: string;
  expectedSalary: string;
  noticePeriod: string;
  highestQualification: string;
  institution: string;
  passingYear: string;
  additionalQualifications?: string;
  skills: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobile: string;
  documents: {
    documentType: string;
    fileName: string;
    storagePath: string;
    fileDataUrl?: string;
    mimeType?: string;
  }[];
}

export async function createJobApplication(payload: CreateApplicationPayload) {
  try {
    const applicationNumber = await generateNextApplicationNumber();

    const insertedApps = await db
      .insert(jobApplications)
      .values({
        applicationNumber,
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
      })
      .returning();

    const application = insertedApps[0];

    if (payload.documents && payload.documents.length > 0) {
      await db.insert(candidateDocuments).values(
        payload.documents.map((doc) => ({
          applicationId: application.id,
          documentType: doc.documentType,
          fileName: doc.fileName,
          storagePath: doc.storagePath,
          fileDataUrl: doc.fileDataUrl || null,
          mimeType: doc.mimeType || 'application/octet-stream',
          verificationStatus: 'PENDING',
        }))
      );
    }

    await db.insert(applicationActivityLogs).values({
      applicationId: application.id,
      action: 'Application submitted',
      oldStatus: null,
      newStatus: 'SUBMITTED',
      remarks: `Application ${applicationNumber} submitted for ${payload.appliedPosition} with ${payload.documents.length} KYC document(s).`,
      performedBy: 'Applicant (Self)',
    });

    return {
      id: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status,
      createdAt: application.createdAt,
    };
  } catch (error) {
    console.error('Database error creating job application:', error);
    throw new Error('Failed to submit application. Please verify your details and try again.', {
      cause: error,
    });
  }
}

export async function listApplicationsForAdmin() {
  try {
    const apps = await db
      .select()
      .from(jobApplications)
      .orderBy(desc(jobApplications.createdAt));

    // Fetch document verification statuses without returning raw fileDataUrl in the bulk list
    const docs = await db
      .select({
        id: candidateDocuments.id,
        applicationId: candidateDocuments.applicationId,
        documentType: candidateDocuments.documentType,
        fileName: candidateDocuments.fileName,
        storagePath: candidateDocuments.storagePath,
        uploadedAt: candidateDocuments.uploadedAt,
        verificationStatus: candidateDocuments.verificationStatus,
        verifiedBy: candidateDocuments.verifiedBy,
        verifiedAt: candidateDocuments.verifiedAt,
        remarks: candidateDocuments.remarks,
      })
      .from(candidateDocuments);

    const docsByAppId = new Map<string, typeof docs>();
    for (const d of docs) {
      const list = docsByAppId.get(d.applicationId) || [];
      list.push(d);
      docsByAppId.set(d.applicationId, list);
    }

    return apps.map((app) => {
      const appDocs = docsByAppId.get(app.id) || [];
      let kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'PENDING';
      if (appDocs.length > 0) {
        if (appDocs.some((d) => d.verificationStatus === 'REJECTED')) {
          kycStatus = 'REJECTED';
        } else if (appDocs.every((d) => d.verificationStatus === 'VERIFIED')) {
          kycStatus = 'VERIFIED';
        }
      }
      return {
        ...app,
        kycStatus,
        documents: appDocs,
      };
    });
  } catch (error) {
    console.error('Database error listing applications:', error);
    throw new Error('Failed to retrieve applications list.', { cause: error });
  }
}

export async function getApplicationDetailsForAdmin(applicationId: string) {
  try {
    const apps = await db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, applicationId));

    if (!apps.length) {
      return null;
    }

    const app = apps[0];

    const docs = await db
      .select({
        id: candidateDocuments.id,
        applicationId: candidateDocuments.applicationId,
        documentType: candidateDocuments.documentType,
        fileName: candidateDocuments.fileName,
        storagePath: candidateDocuments.storagePath,
        mimeType: candidateDocuments.mimeType,
        uploadedAt: candidateDocuments.uploadedAt,
        verificationStatus: candidateDocuments.verificationStatus,
        verifiedBy: candidateDocuments.verifiedBy,
        verifiedAt: candidateDocuments.verifiedAt,
        remarks: candidateDocuments.remarks,
      })
      .from(candidateDocuments)
      .where(eq(candidateDocuments.applicationId, applicationId));

    const logs = await db
      .select()
      .from(applicationActivityLogs)
      .where(eq(applicationActivityLogs.applicationId, applicationId))
      .orderBy(desc(applicationActivityLogs.createdAt));

    let kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'PENDING';
    if (docs.length > 0) {
      if (docs.some((d) => d.verificationStatus === 'REJECTED')) {
        kycStatus = 'REJECTED';
      } else if (docs.every((d) => d.verificationStatus === 'VERIFIED')) {
        kycStatus = 'VERIFIED';
      }
    }

    return {
      ...app,
      kycStatus,
      documents: docs,
      activityLogs: logs,
    };
  } catch (error) {
    console.error('Database error fetching application details:', error);
    throw new Error('Failed to load applicant details.', { cause: error });
  }
}

export async function getAuthenticatedDocumentData(documentId: string) {
  try {
    const docs = await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.id, documentId));
    return docs[0] || null;
  } catch (error) {
    console.error('Database error loading document:', error);
    throw new Error('Failed to load secure document.', { cause: error });
  }
}

export async function verifyOrRejectDocument(
  documentId: string,
  verificationStatus: 'VERIFIED' | 'REJECTED' | 'PENDING',
  remarks: string | undefined,
  performedBy: string
) {
  try {
    const existingDocs = await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.id, documentId));

    if (!existingDocs.length) {
      throw new Error('Document not found.');
    }

    const doc = existingDocs[0];
    const now = new Date();

    const updated = await db
      .update(candidateDocuments)
      .set({
        verificationStatus,
        verifiedBy: performedBy,
        verifiedAt: now,
        remarks: remarks?.trim() || null,
      })
      .where(eq(candidateDocuments.id, documentId))
      .returning();

    const actionText =
      verificationStatus === 'VERIFIED'
        ? `Document verified (${doc.documentType})`
        : verificationStatus === 'REJECTED'
        ? `Document rejected (${doc.documentType})`
        : `Document reset to pending (${doc.documentType})`;

    await db.insert(applicationActivityLogs).values({
      applicationId: doc.applicationId,
      action: actionText,
      oldStatus: doc.verificationStatus,
      newStatus: verificationStatus,
      remarks: remarks?.trim() || `${doc.fileName} marked as ${verificationStatus}`,
      performedBy,
    });

    return updated[0];
  } catch (error) {
    console.error('Database error updating document verification:', error);
    throw new Error('Failed to update document verification status.', { cause: error });
  }
}

export async function updateApplicationStatusAndRemarks(
  applicationId: string,
  params: {
    status?: string;
    adminRemarks?: string;
    rejectionReason?: string;
    performedBy: string;
  }
) {
  try {
    const existingApps = await db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, applicationId));

    if (!existingApps.length) {
      throw new Error('Application not found.');
    }

    const currentApp = existingApps[0];
    const now = new Date();

    const updateFields: Record<string, any> = {
      updatedAt: now,
      reviewedAt: now,
      reviewedBy: params.performedBy,
    };

    if (params.status !== undefined) {
      updateFields.status = params.status;
    }
    if (params.adminRemarks !== undefined) {
      updateFields.adminRemarks = params.adminRemarks;
    }
    if (params.rejectionReason !== undefined) {
      updateFields.rejectionReason = params.rejectionReason;
    }

    const updated = await db
      .update(jobApplications)
      .set(updateFields)
      .where(eq(jobApplications.id, applicationId))
      .returning();

    let actionLabel = 'Status changed';
    if (params.status === 'SHORTLISTED') actionLabel = 'Candidate shortlisted';
    else if (params.status === 'SELECTED') actionLabel = 'Candidate selected';
    else if (params.status === 'REJECTED') actionLabel = 'Candidate rejected';
    else if (params.status === 'ON_HOLD') actionLabel = 'Candidate placed on hold';
    else if (params.status === 'UNDER_REVIEW') actionLabel = 'Moved to under review';
    else if (!params.status && params.adminRemarks !== undefined) actionLabel = 'Admin remark added';

    await db.insert(applicationActivityLogs).values({
      applicationId,
      action: actionLabel,
      oldStatus: currentApp.status,
      newStatus: params.status || currentApp.status,
      remarks:
        params.rejectionReason ||
        params.adminRemarks ||
        `Status updated from ${currentApp.status} to ${params.status || currentApp.status}`,
      performedBy: params.performedBy,
    });

    return updated[0];
  } catch (error) {
    console.error('Database error updating application status:', error);
    throw new Error('Failed to update application status.', { cause: error });
  }
}

export async function bulkUpdateApplicationStatus(
  applicationIds: string[],
  newStatus: string,
  rejectionReason: string | undefined,
  performedBy: string
) {
  try {
    const results = [];
    for (const id of applicationIds) {
      const updated = await updateApplicationStatusAndRemarks(id, {
        status: newStatus,
        rejectionReason,
        performedBy,
      });
      results.push(updated);
    }
    return results;
  } catch (error) {
    console.error('Database error performing bulk status update:', error);
    throw new Error('Failed to complete bulk status update.', { cause: error });
  }
}
