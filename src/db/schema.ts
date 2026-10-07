import { relations } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Admin profile table as specified in requirements (#25)
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().unique(), // Firebase Auth UID or Supabase User ID
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('SUPER_ADMIN'), // 'SUPER_ADMIN' | 'ADMIN' | 'HR'
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Job applications table as specified in requirements (#11)
export const jobApplications = pgTable('job_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationNumber: text('application_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  parentName: text('parent_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  gender: text('gender').notNull(),
  mobile: text('mobile').notNull(),
  alternateMobile: text('alternate_mobile'),
  email: text('email'),
  address: text('address').notNull(),
  district: text('district').notNull(),
  state: text('state').notNull(),
  pinCode: text('pin_code').notNull(),
  appliedPosition: text('applied_position').notNull(),
  preferredLocation: text('preferred_location').notNull(),
  experience: text('experience').notNull(),
  totalExperience: text('total_experience').notNull(),
  previousCompany: text('previous_company'),
  previousDesignation: text('previous_designation'),
  expectedSalary: text('expected_salary').notNull(),
  noticePeriod: text('notice_period').notNull(),
  highestQualification: text('highest_qualification').notNull(),
  institution: text('institution').notNull(),
  passingYear: text('passing_year').notNull(),
  additionalQualifications: text('additional_qualifications'),
  skills: text('skills').notNull(),
  emergencyContactName: text('emergency_contact_name').notNull(),
  emergencyContactRelationship: text('emergency_contact_relationship').notNull(),
  emergencyContactMobile: text('emergency_contact_mobile').notNull(),
  status: text('status').notNull().default('SUBMITTED'), // 'SUBMITTED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED' | 'ON_HOLD'
  adminRemarks: text('admin_remarks'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by'),
});

// Candidate KYC documents table as specified in requirements (#12)
export const candidateDocuments = pgTable('candidate_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id')
    .references(() => jobApplications.id, { onDelete: 'cascade' })
    .notNull(),
  documentType: text('document_type').notNull(), // 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'EDUCATIONAL_CERTIFICATE' | 'BANK_PASSBOOK'
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  fileDataUrl: text('file_data_url'), // Encrypted/private storage payload for preview & verification
  mimeType: text('mime_type').default('application/octet-stream'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  verificationStatus: text('verification_status').notNull().default('PENDING'), // 'PENDING' | 'VERIFIED' | 'REJECTED'
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at'),
  remarks: text('remarks'),
});

// Audit log table as specified in requirements (#23)
export const applicationActivityLogs = pgTable('application_activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id')
    .references(() => jobApplications.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(),
  oldStatus: text('old_status'),
  newStatus: text('new_status'),
  remarks: text('remarks'),
  performedBy: text('performed_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const jobApplicationsRelations = relations(jobApplications, ({ many }) => ({
  documents: many(candidateDocuments),
  activityLogs: many(applicationActivityLogs),
}));

export const candidateDocumentsRelations = relations(candidateDocuments, ({ one }) => ({
  application: one(jobApplications, {
    fields: [candidateDocuments.applicationId],
    references: [jobApplications.id],
  }),
}));

export const applicationActivityLogsRelations = relations(applicationActivityLogs, ({ one }) => ({
  application: one(jobApplications, {
    fields: [applicationActivityLogs.applicationId],
    references: [jobApplications.id],
  }),
}));
