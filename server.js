const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');

const app = express();

// express.json() для парсинга JSON в эндпоинтах
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
        fieldSize: 10 * 1024 * 1024   // 10 MB для текстовых полей
    }
});

// проверка использования памяти
function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`
    };
}

function logMemory(label) {
    const mem = getMemoryUsage();
    console.log(`[MEMORY - ${label}] RSS: ${mem.rss}, Heap: ${mem.heapUsed}/${mem.heapTotal}, External: ${mem.external}`);
}

// Функция парсинга блоков страниц с авто-обрезкой
function parsePageBlock(block, totalPages) {
    const pageIndices = new Set();
    const noSpaceBlock = block.replace(/\s+/g, '')
    const parts = noSpaceBlock.split(',');

    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            let end = parseInt(endStr, 10);

            if (isNaN(start) || isNaN(end)) {
                throw new Error(`Некорректный диапазон: ${part}`);
            }
            
            // Пропускаем если начало за пределами
            if (start > totalPages) {
                console.log(`Диапазон ${start}-${end} пропущен: выходит за пределы (всего ${totalPages} стр.)`);
                continue;
            }
            
            // Обрезаем конец если выходит за пределы
            if (end > totalPages) {
                console.log(`Диапазон ${start}-${end} обрезан до ${start}-${totalPages}`);
                end = totalPages;
            }
            
            if (start > end) {
                continue;
            }

            for (let i = start; i <= end; i++) {
                pageIndices.add(i - 1);
            }
        } else {
            const pageNum = parseInt(part, 10);
            if (isNaN(pageNum)) {
                throw new Error(`Некорректный номер страницы: ${part}`);
            }
            
            // Пропускаем страницы за пределами
            if (pageNum < 1 || pageNum > totalPages) {
                console.log(`Страница ${pageNum} пропущена: выходит за пределы (1-${totalPages})`);
                continue;
            }
            
            pageIndices.add(pageNum - 1);
        }
    }

    return Array.from(pageIndices).sort((a, b) => a - b);
}
// Форматирование страниц в имени файла по шаблону
function formatPageLabel(pages) {
    if (pages.length === 1) {
        return `стр_${pages[0]}`;
    }
    return `стр_${pages.join(',')}`;
}

// Эндпоинт для нарезки на части
app.post('/split-all', upload.single('pdf'), async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('\n=== /split-all НАЧАЛО ===');
        logMemory('начало запроса');

        if (!req.file) {
            return res.status(400).json({ error: 'PDF файл не найден' });
        }

        const chunkSize = parseInt(req.body.chunkSize, 10);
        if (isNaN(chunkSize) || chunkSize <= 0) {
            return res.status(400).json({ error: 'Некорректный размер части' });
        }

        const baseName = req.body.originalFileName.replace(/\.pdf$/i, '') || 'document';
        console.log(`Файл: ${baseName}, размер: ${req.file.size} байт, chunkSize: ${chunkSize}`);

        console.log('Загрузка PDF документа из памяти...');
        const sourcePdf = await PDFDocument.load(req.file.buffer);
        const totalPages = sourcePdf.getPageCount();
        console.log(`PDF загружен, всего страниц: ${totalPages}`);
        logMemory('после загрузки PDF');

        const totalParts = Math.ceil(totalPages / chunkSize);
        console.log(`Всего страниц: ${totalPages}, частей: ${totalParts}`);

        const parts = [];
        for (let partIndex = 0; partIndex < totalParts; partIndex++) {
            const startPage = partIndex * chunkSize;
            const endPage = Math.min(startPage + chunkSize, totalPages);

            const pageIndices = [];
            for (let i = startPage; i < endPage; i++) {
                pageIndices.push(i);
            }

            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(sourcePdf, pageIndices);
            pages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            const base64Data = Buffer.from(pdfBytes).toString('base64');

            const start = startPage + 1;
            const end = endPage;
            const fileName = `${baseName} стр_${start}-${end}.pdf`;

            parts.push({
                partIndex: partIndex + 1,
                pageStart: start,
                pageEnd: end,
                size: pdfBytes.length,
                data: base64Data,
                fileName: fileName
            });

            console.log(`Часть ${partIndex + 1}: ${fileName}, размер: ${pdfBytes.length} байт`);
        }

        const duration = Date.now() - startTime;
        console.log(`Обработка завершена за ${duration}мс, создано частей: ${parts.length}`);
        logMemory('перед завершением');
        console.log('=== /split-all ЗАВЕРШЕН ===\n');

        res.json({
            success: true,
            totalParts: totalParts,
            totalPages: totalPages,
            chunkSize: chunkSize,
            processingTimeMs: duration,
            parts: parts
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`ОШИБКА после ${duration}мс:`, error.message);
        console.error('Стек ошибки:', error.stack);
        logMemory('при ошибке');

        if (!res.headersSent) {
            let userMessage = error.message;
            let statusCode = 500;

            if (error.message.includes('PDF encryption')) {
                userMessage = 'PDF файл защищен паролем. Снимите защиту и попробуйте снова.';
                statusCode = 400;
            } else if (error.message.includes('Invalid PDF')) {
                userMessage = 'Файл не является валидным PDF документом.';
                statusCode = 400;
            } else if (error.message.includes('memory')) {
                userMessage = 'Файл слишком большой для обработки. Максимальный размер: 100 МБ.';
                statusCode = 413;
            }

            res.status(statusCode).json({ success: false, error: userMessage });
        }
    }
});

// Эндпоинт для нарезки PDF по шаблону
app.post('/split-pdf', upload.single('pdf'), async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('\n=== НАЧАЛО ОБРАБОТКИ (/split-pdf) ===');
        logMemory('начало запроса');

        if (!req.file) {
            return res.status(400).json({ error: 'PDF файл не найден' });
        }

        console.log(`Файл получен: ${req.body.originalFileName}, размер: ${req.file.size} байт`);

        const template = req.body.template;
        console.log(`Шаблон нарезки: ${template}`);

        if (!template || template.trim() === '') {
            return res.status(400).json({ error: 'Шаблон нарезки не указан' });
        }

        console.log('Загрузка PDF документа из памяти...');
        const sourcePdf = await PDFDocument.load(req.file.buffer);
        const totalPages = sourcePdf.getPageCount();
        console.log(`PDF загружен, всего страниц: ${totalPages}`);
        logMemory('после загрузки PDF');

        const blocks = template.split(';').filter(b => b.trim() !== '');

        if (blocks.length === 0) {
            return res.status(400).json({ error: 'Шаблон не содержит ни одного блока' });
        }

        console.log(`Найдено блоков: ${blocks.length}`);

        const baseName = req.body.originalFileName.replace(/\.pdf$/i, '') || 'document'
        const letters = [];

        for (let idx = 0; idx < blocks.length; idx++) {
            const block = blocks[idx];
            console.log(`\n--- Обработка блока ${idx + 1}: "${block}" ---`);

            const pageIndices = parsePageBlock(block, totalPages);

            if (pageIndices.length === 0) {
                console.log(`Блок ${idx + 1} пропущен: нет валидных страниц`);
                continue;
            }

            const realPages = pageIndices.map(i => i + 1);
            console.log(`Страницы: ${realPages.join(', ')}`);

            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(sourcePdf, pageIndices);
            pages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            const base64Data = Buffer.from(pdfBytes).toString('base64');

            const pageLabel = formatPageLabel(realPages);
            const fileName = `${baseName} письмо_${pageLabel}.pdf`;

            letters.push({
                letterIndex: idx + 1,
                template: block,
                pages: realPages,
                pageCount: pageIndices.length,
                fileName: fileName,
                size: pdfBytes.length,
                data: base64Data
            });

            console.log(`Блок ${idx + 1}: ${pageIndices.length} стр, размер: ${pdfBytes.length} байт`);
        }

        const duration = Date.now() - startTime;

        if (letters.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Не удалось создать ни одного письма.'
            });
        }

        console.log(`Обработка завершена за ${duration}мс, создано писем: ${letters.length}`);
        logMemory('перед завершением');
        console.log('=== ОБРАБОТКА ЗАВЕРШЕНА ===\n');

        res.json({
            success: true,
            totalPages: totalPages,
            totalLetters: letters.length,
            processingTimeMs: duration,
            letters: letters
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`ОШИБКА после ${duration}мс:`, error.message);

        if (!res.headersSent) {
            let userMessage = error.message;
            let statusCode = 500;

            if (error.message.includes('PDF encryption')) {
                userMessage = 'PDF файл защищен паролем.';
                statusCode = 400;
            } else if (error.message.includes('Invalid PDF')) {
                userMessage = 'Файл не является валидным PDF.';
                statusCode = 400;
            } else if (error.message.includes('memory')) {
                userMessage = 'Файл слишком большой. Максимум: 100 МБ.';
                statusCode = 413;
            }

            res.status(statusCode).json({ success: false, error: userMessage });
        }
    }
});

app.get('/debug/memory', (req, res) => {
    res.json({
        memory: getMemoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime())
    });
});

const PORT = process.env.PORT ||8082;
app.listen(PORT,'0.0.0.0', () => {
    console.log(`\n PDF Splitter Microservice`);
    console.log(`Порт: ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Memory: http://localhost:${PORT}/debug/memory`);
    console.log(`Split-PDF: POST http://localhost:${PORT}/split-pdf`);
    console.log(`Split-All: POST http://localhost:${PORT}/split-all`);
    console.log(`Максимальный размер файла: 100 MB\n`);
    logMemory('при старте сервера');
});
