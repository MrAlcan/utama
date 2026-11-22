import { randomBytes } from 'node:crypto';
import { extname, join } from 'node:path';
import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';

const almacenamiento = multer.diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}${extname(file.originalname).toLowerCase()}`),
});

@Controller('uploads')
export class UploadsController {
  /** Sube una imagen (campo "file") y devuelve su URL pública. */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: almacenamiento,
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf'),
    }),
  )
  subir(@UploadedFile() file?: { filename: string }) {
    if (!file) throw new BadRequestException('Envía una imagen o un PDF en el campo "file" (máx. 8 MB)');
    const base = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    return { url: `${base}/uploads/${file.filename}` };
  }
}
