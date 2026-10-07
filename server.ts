import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateAdminUser,
  getAllAdminUsers,
  updateAdminUserRole,
  checkDuplicateApplication,
  createJobApplication,
  listApplicationsForAdmin,
  getApplicationDetailsForAdmin,
  getAuthenticatedDocumentData,
  verifyOrRejectDocument,
  updateApplicationStatusAndRemarks,
  bulkUpdateApplicationStatus,
} from './src/db/repository.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow up to 35MB JSON bodies for multi-document KYC base64/dataURL uploads
  app.use(express.json({ limit: '35mb' }));

  const ensureSeeded = async () => {
    // No mock or sample data seeding
  };

  // ===========================================================================
  // PUBLIC APPLICANT ROUTES
  // ===========================================================================

  // Check duplicate application (#28)
  app.post('/api/applications/check-duplicate', async (req, res) => {
    try {
      await ensureSeeded();
      const { mobile, email, appliedPosition } = req.body;
      if (!mobile || !appliedPosition) {
        return res.status(400).json({ error: 'Mobile number and applied position are required.' });
      }
      const exists = await checkDuplicateApplication(mobile, email, appliedPosition);
      if (exists) {
        return res.status(409).json({
          duplicate: true,
          message:
            'An application already exists with these details. Please contact Doorbly recruitment support if you need to update your application.',
        });
      }
      return res.json({ duplicate: false });
    } catch (error: any) {
      console.error('Error in check-duplicate:', error);
      return res.status(500).json({ error: error.message || 'Unable to verify duplicate status.' });
    }
  });

  // Submit new application + KYC documents (#10)
  app.post('/api/applications', async (req, res) => {
    try {
      await ensureSeeded();
      const payload = req.body;

      // Backend validation (#29)
      if (!payload.fullName || !payload.mobile || !payload.appliedPosition) {
        return res.status(400).json({ error: 'Required personal and position fields are missing.' });
      }

      if (!/^[6-9]\d{9}$/.test(String(payload.mobile).trim())) {
        return res.status(400).json({ error: 'Please provide a valid 10-digit Indian mobile number.' });
      }

      if (!/^[1-9]\d{5}$/.test(String(payload.pinCode).trim())) {
        return res.status(400).json({ error: 'Please provide a valid 6-digit PIN code.' });
      }

      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email).trim())) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      const isDuplicate = await checkDuplicateApplication(
        payload.mobile,
        payload.email,
        payload.appliedPosition
      );

      if (isDuplicate) {
        return res.status(409).json({
          error:
            'An application already exists with these details. Please contact Doorbly recruitment support if you need to update your application.',
        });
      }

      const created = await createJobApplication(payload);
      // Do NOT expose document URLs in submission response (#10)
      return res.status(201).json({
        id: created.id,
        applicationNumber: created.applicationNumber,
        status: created.status,
        createdAt: created.createdAt,
      });
    } catch (error: any) {
      console.error('Error creating application:', error);
      return res.status(500).json({
        error: error.message || 'Failed to submit application. Please try again.',
      });
    }
  });

  // ===========================================================================
  // ADMIN AUTHENTICATION & PROTECTED ROUTES (#13 - #25)
  // ===========================================================================

  // Admin credential login endpoint
  app.post('/api/admin/login', async (req, res) => {
    try {
      await ensureSeeded();
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      // Strictly restrict login to debabrata.tribune@gmail.com and Devraj@1122
      if (cleanEmail !== 'debabrata.tribune@gmail.com' || password !== 'Devraj@1122') {
        return res.status(401).json({
          error: 'Unauthorized: Access is restricted exclusively to the authorized administrator account.',
        });
      }

      const profile = await getOrCreateAdminUser(
        'admin-super-tribune',
        'debabrata.tribune@gmail.com',
        'Debabrata Mohanta'
      );
      if (!profile.active) {
        return res.status(403).json({ error: 'Your administrator account is currently inactive.' });
      }

      const token = `doorbly-admin-session:${cleanEmail}:admin-super-tribune`;
      return res.json({
        token,
        admin: profile,
      });
    } catch (error: any) {
      console.error('Error in admin login:', error);
      return res.status(500).json({ error: 'Authentication service failed. Please try again.' });
    }
  });

  // Get current authenticated admin profile
  app.get('/api/admin/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const email = (req.user?.email || '').trim().toLowerCase();
      if (email !== 'debabrata.tribune@gmail.com') {
        return res.status(403).json({
          error: 'Access Denied: Only debabrata.tribune@gmail.com is authorized to access the Admin Panel.',
        });
      }
      const uid = req.user?.uid || 'admin-super-tribune';
      const name = req.user?.name || 'Debabrata Mohanta';
      const profile = await getOrCreateAdminUser(uid, email, name);
      return res.json({ admin: profile });
    } catch (error: any) {
      console.error('Error fetching admin profile:', error);
      return res.status(500).json({ error: error.message || 'Failed to load admin profile' });
    }
  });

  // Get all admin users (#25)
  app.get('/api/admin/users', requireAuth, async (_req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const users = await getAllAdminUsers();
      return res.json({ users });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to load admin users' });
    }
  });

  // Update admin user role (#25)
  app.patch('/api/admin/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { role, active } = req.body;
      const updated = await updateAdminUserRole(req.params.id, role, active);
      return res.json({ user: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to update admin user' });
    }
  });

  // List all applications for Excel-style dashboard (#14, #15)
  app.get('/api/admin/applications', requireAuth, async (_req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const applications = await listApplicationsForAdmin();
      return res.json({ applications });
    } catch (error: any) {
      console.error('Error listing applications:', error);
      return res.status(500).json({ error: error.message || 'Failed to load applications' });
    }
  });

  // Get single application full details, KYC documents & audit logs (#16)
  app.get('/api/admin/applications/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const details = await getApplicationDetailsForAdmin(req.params.id);
      if (!details) {
        return res.status(404).json({ error: 'Application not found.' });
      }
      return res.json({ application: details });
    } catch (error: any) {
      console.error('Error loading application details:', error);
      return res.status(500).json({ error: error.message || 'Failed to load applicant details' });
    }
  });

  // Authenticated private document access (#16: View Document via authenticated access, never permanent public URLs)
  app.get('/api/admin/documents/:docId/view', requireAuth, async (req: AuthRequest, res) => {
    try {
      const doc = await getAuthenticatedDocumentData(req.params.docId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      return res.json({
        id: doc.id,
        fileName: doc.fileName,
        documentType: doc.documentType,
        storagePath: doc.storagePath,
        mimeType: doc.mimeType,
        signedDataUrl: doc.fileDataUrl,
        expiresInSeconds: 300,
      });
    } catch (error: any) {
      console.error('Error accessing private document:', error);
      return res.status(500).json({ error: error.message || 'Failed to retrieve private document' });
    }
  });

  // Verify or Reject KYC document (#17)
  app.patch('/api/admin/documents/:docId/verify', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { verificationStatus, remarks, performedBy } = req.body;
      if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(verificationStatus)) {
        return res.status(400).json({ error: 'Invalid verification status.' });
      }
      if (verificationStatus === 'REJECTED' && (!remarks || !String(remarks).trim())) {
        return res.status(400).json({ error: 'A rejection reason is required when rejecting a KYC document.' });
      }

      const actor = performedBy || req.user?.email || 'Administrator';
      const updated = await verifyOrRejectDocument(
        req.params.docId,
        verificationStatus,
        remarks,
        actor
      );
      return res.json({ document: updated });
    } catch (error: any) {
      console.error('Error verifying document:', error);
      return res.status(500).json({ error: error.message || 'Failed to verify document' });
    }
  });

  // Update application status, select/reject, shortlist, hold, or admin remarks (#18, #19, #22)
  app.patch('/api/admin/applications/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { status, adminRemarks, rejectionReason, performedBy } = req.body;
      if (status === 'REJECTED' && (!rejectionReason || !String(rejectionReason).trim())) {
        return res.status(400).json({ error: 'Rejection reason is required when rejecting a candidate.' });
      }

      const actor = performedBy || req.user?.email || 'Administrator';
      const updated = await updateApplicationStatusAndRemarks(req.params.id, {
        status,
        adminRemarks,
        rejectionReason,
        performedBy: actor,
      });
      return res.json({ application: updated });
    } catch (error: any) {
      console.error('Error updating application status:', error);
      return res.status(500).json({ error: error.message || 'Failed to update application status' });
    }
  });

  // Bulk shortlist / Bulk reject (#20)
  app.post('/api/admin/applications/bulk-status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { applicationIds, status, rejectionReason, performedBy } = req.body;
      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one application.' });
      }
      if (!['SHORTLISTED', 'REJECTED', 'UNDER_REVIEW', 'ON_HOLD'].includes(status)) {
        return res.status(400).json({ error: 'Invalid bulk status action.' });
      }
      if (status === 'REJECTED' && (!rejectionReason || !String(rejectionReason).trim())) {
        return res.status(400).json({ error: 'Rejection reason is required for bulk rejection.' });
      }

      const actor = performedBy || req.user?.email || 'Administrator';
      const updated = await bulkUpdateApplicationStatus(
        applicationIds,
        status,
        rejectionReason,
        actor
      );
      return res.json({ updatedCount: updated.length });
    } catch (error: any) {
      console.error('Error in bulk status update:', error);
      return res.status(500).json({ error: error.message || 'Bulk action failed' });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Doorbly Recruitment & KYC Server running on http://localhost:${PORT}`);
  });
}

startServer();
