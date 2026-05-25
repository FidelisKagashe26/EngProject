import { Router, type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { handleAsync } from "./utils";

const router = Router();

const GALLERY_UPLOAD_DIR = path.join(process.cwd(), "uploads", "gallery");
const DOCUMENT_UPLOAD_DIR = path.join(process.cwd(), "uploads", "documents");

const ensureDirectory = (directoryPath: string): void => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

ensureDirectory(GALLERY_UPLOAD_DIR);
ensureDirectory(DOCUMENT_UPLOAD_DIR);

const createStorage = (uploadDir: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      cb(null, unique);
    },
  });

const createFileFilter = (
  allowedMimeTypes: string[],
  errorMessage: string,
) => (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error(errorMessage));
};

const createUploader = (
  uploadDir: string,
  allowedMimeTypes: string[],
  errorMessage: string,
  maxFileSizeMb: number,
) =>
  multer({
    storage: createStorage(uploadDir),
    fileFilter: createFileFilter(allowedMimeTypes, errorMessage),
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024,
    },
  });

const imageMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const documentMimeTypes = [
  ...imageMimeTypes,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

const uploadGallery = createUploader(
  GALLERY_UPLOAD_DIR,
  imageMimeTypes,
  "Only image files are allowed (JPEG, PNG, WebP, GIF).",
  10,
);

const uploadDocument = createUploader(
  DOCUMENT_UPLOAD_DIR,
  documentMimeTypes,
  "Only PDF, image, DOC, DOCX, XLS, XLSX, CSV, TXT and ZIP files are allowed.",
  20,
);

const handleMulterError = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "File is too large." });
      return;
    }
    res.status(400).json({ message: err.message });
    return;
  }

  if (err instanceof Error) {
    res.status(400).json({ message: err.message });
    return;
  }

  next(err);
};

router.post(
  "/gallery",
  (req: Request, res: Response, next: NextFunction) => {
    uploadGallery.single("image")(req, res, (err) => {
      if (err) {
        handleMulterError(err, req, res, next);
        return;
      }
      next();
    });
  },
  handleAsync(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "No image file provided." });
      return;
    }

    const url = `/uploads/gallery/${req.file.filename}`;
    res.status(201).json({
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }),
);

router.post(
  "/document",
  (req: Request, res: Response, next: NextFunction) => {
    uploadDocument.single("file")(req, res, (err) => {
      if (err) {
        handleMulterError(err, req, res, next);
        return;
      }
      next();
    });
  },
  handleAsync(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "No document file provided." });
      return;
    }

    const url = `/uploads/documents/${req.file.filename}`;
    res.status(201).json({
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }),
);

router.delete(
  "/gallery/:filename",
  handleAsync(async (req, res) => {
    const filename = path.basename(String(req.params.filename));
    const filePath = path.join(GALLERY_UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ message: "File deleted." });
  }),
);

router.delete(
  "/document/:filename",
  handleAsync(async (req, res) => {
    const filename = path.basename(String(req.params.filename));
    const filePath = path.join(DOCUMENT_UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ message: "File deleted." });
  }),
);

export default router;
