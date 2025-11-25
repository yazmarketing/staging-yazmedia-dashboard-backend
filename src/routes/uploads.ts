import { Router } from 'express';
import { upload, uploadFileToSpaces } from '../utils/fileUpload';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

/**
 * Upload reimbursement receipt
 * POST /uploads/reimbursements
 */
router.post('/reimbursements', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Reimbursement upload request received');
    console.log('File in request:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    } : 'No file');

    if (!req.file) {
      console.error('❌ No file uploaded in request');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // uploadFileToSpaces will automatically fallback to local storage if Spaces is not configured
    console.log('🚀 Starting file upload...');
    const fileUrl = await uploadFileToSpaces(req.file, 'reimbursements');
    console.log('✅ File uploaded successfully:', fileUrl);

    return res.json({
      success: true,
      data: { url: fileUrl },
      message: 'File uploaded successfully',
    });
  } catch (error: any) {
    console.error('❌ Error uploading file:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
  }
});

/**
 * Upload employee document
 * POST /uploads/documents
 * Query params: employeeId, documentType (PASSPORT, EMIRATES_ID, CERTIFICATE, OTHER)
 */
router.post('/documents', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const { employeeId, documentType } = req.query;

    // Upload file to Spaces
    const fileUrl = await uploadFileToSpaces(req.file, 'documents');

    // If employeeId and documentType are provided, create EmployeeDocument record
    if (employeeId && documentType) {
      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId as string },
      });

      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Check if document type already exists for this employee (for PASSPORT and EMIRATES_ID, only one allowed)
      if (documentType === 'PASSPORT' || documentType === 'EMIRATES_ID') {
        const existing = await prisma.employeeDocument.findFirst({
          where: {
            employeeId: employeeId as string,
            documentType: documentType as any,
          },
        });

        if (existing) {
          // Update existing document
          const updated = await prisma.employeeDocument.update({
            where: { id: existing.id },
            data: {
              name: req.file.originalname,
              url: fileUrl,
              uploadedAt: new Date(),
            },
          });

          res.json({
            success: true,
            data: { url: fileUrl, document: updated },
            message: 'Document updated successfully',
          });
          return;
        }
      }

      // Create new document record
      const document = await prisma.employeeDocument.create({
        data: {
          employeeId: employeeId as string,
          documentType: documentType as any,
          name: req.file.originalname,
          url: fileUrl,
        },
      });

      res.json({
        success: true,
        data: { url: fileUrl, document },
        message: 'Document uploaded and saved successfully',
      });
      return;
    }

    // If no employeeId/documentType, just return the URL (for backward compatibility)
    res.json({
      success: true,
      data: { url: fileUrl },
      message: 'File uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
  }
});

/**
 * Upload announcement attachment
 * POST /uploads/announcements
 */
router.post('/announcements', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const fileUrl = await uploadFileToSpaces(req.file, 'announcements');

    res.json({
      success: true,
      data: { url: fileUrl },
      message: 'File uploaded successfully',
    });
    return;
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
    return;
  }
});

/**
 * Upload asset image or invoice
 * POST /uploads/assets
 */
router.post('/assets', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const fileUrl = await uploadFileToSpaces(req.file, 'assets');

    res.json({
      success: true,
      data: { url: fileUrl },
      message: 'File uploaded successfully',
    });
    return;
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
    return;
  }
});

export default router;

