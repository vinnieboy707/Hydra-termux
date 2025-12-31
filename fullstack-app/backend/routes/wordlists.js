const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const wordlistsPath = process.env.WORDLISTS_PATH || path.join(__dirname, '../../../wordlists');
    try {
      await fs.mkdir(wordlistsPath, { recursive: true });
      cb(null, wordlistsPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only allow .txt files
    if (!file.originalname.endsWith('.txt')) {
      return cb(new Error('Only .txt files are allowed'));
    }
    // Additional mime type check
    if (file.mimetype !== 'text/plain' && file.mimetype !== 'application/octet-stream') {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});

// Get all wordlists
router.get('/', authMiddleware, async (req, res) => {
  try {
    const wordlists = await all('SELECT * FROM wordlists ORDER BY created_at DESC');
    res.json({ wordlists });
  } catch (error) {
    console.error('Error fetching wordlists:', error);
    res.status(500).json({ error: 'Failed to fetch wordlists' });
  }
});

// Get wordlist content
router.get('/:id/content', authMiddleware, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const wordlist = await get('SELECT * FROM wordlists WHERE id = ?', [req.params.id]);
    
    if (!wordlist) {
      return res.status(404).json({ error: 'Wordlist not found' });
    }

    const content = await fs.readFile(wordlist.path, 'utf-8');
    const lines = content.split('\n');
    const limitedContent = lines.slice(0, parseInt(limit)).join('\n');
    
    res.json({ 
      content: limitedContent,
      totalLines: lines.length,
      showing: Math.min(parseInt(limit), lines.length)
    });
  } catch (error) {
    console.error('Error reading wordlist:', error);
    res.status(500).json({ error: 'Failed to read wordlist content' });
  }
});

// Upload wordlist
router.post('/upload', authMiddleware, upload.single('wordlist'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    
    // Count lines
    const content = await fs.readFile(filePath, 'utf-8');
    const lineCount = content.split('\n').filter(line => line.trim()).length;
    
    // Check if already in database
    const existing = await get('SELECT id FROM wordlists WHERE name = ?', [fileName]);
    
    if (existing) {
      return res.status(400).json({ error: 'Wordlist with this name already exists' });
    }

    // Add to database
    await run(
      `INSERT INTO wordlists (name, type, path, size, line_count)
       VALUES (?, ?, ?, ?, ?)`,
      [fileName, 'password', filePath, req.file.size, lineCount]
    );

    res.json({ 
      message: 'Wordlist uploaded successfully',
      name: fileName,
      size: req.file.size,
      lineCount
    });
  } catch (error) {
    console.error('Error uploading wordlist:', error);
    res.status(500).json({ error: 'Failed to upload wordlist' });
  }
});

// Delete wordlist
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const wordlist = await get('SELECT * FROM wordlists WHERE id = ?', [req.params.id]);
    
    if (!wordlist) {
      return res.status(404).json({ error: 'Wordlist not found' });
    }

    // Delete file
    try {
      await fs.unlink(wordlist.path);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete from database
    await run('DELETE FROM wordlists WHERE id = ?', [req.params.id]);

    res.json({ message: 'Wordlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting wordlist:', error);
    res.status(500).json({ error: 'Failed to delete wordlist' });
  }
});

// Generate custom wordlist
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { generatorType, name, type, ...options } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Wordlist name is required' });
    }

    const wordlistsPath = process.env.WORDLISTS_PATH || path.join(__dirname, '../../../wordlists');
    await fs.mkdir(wordlistsPath, { recursive: true });

    let entries = [];

    switch (generatorType) {
      case 'combine':
        entries = await generateCombined(options, wordlistsPath);
        break;
      case 'pattern':
        entries = await generatePattern(options);
        break;
      case 'custom':
        entries = options.customEntries.split('\n').filter(e => e.trim());
        break;
      default:
        return res.status(400).json({ error: 'Invalid generator type' });
    }

    // Apply processing options
    if (options.dedupe) {
      entries = [...new Set(entries)];
    }

    if (options.sort) {
      entries.sort();
    }

    // Save to file
    const fileName = name.endsWith('.txt') ? name : `${name}.txt`;
    const filePath = path.join(wordlistsPath, fileName);
    const content = entries.join('\n');
    await fs.writeFile(filePath, content);

    // Get file stats
    const stats = await fs.stat(filePath);

    // Add to database
    await run(
      `INSERT INTO wordlists (name, type, path, size, line_count)
       VALUES (?, ?, ?, ?, ?)`,
      [fileName, type || 'password', filePath, stats.size, entries.length]
    );

    res.json({
      message: 'Wordlist generated successfully',
      name: fileName,
      path: filePath,
      size: stats.size,
      lineCount: entries.length
    });
  } catch (error) {
    console.error('Error generating wordlist:', error);
    res.status(500).json({ error: 'Failed to generate wordlist: ' + error.message });
  }
});

async function generateCombined(options, wordlistsPath) {
  const entries = [];
  
  for (const wordlistId of options.sourceWordlists || []) {
    const wordlist = await get('SELECT * FROM wordlists WHERE id = ?', [wordlistId]);
    if (wordlist) {
      const content = await fs.readFile(wordlist.path, 'utf-8');
      entries.push(...content.split('\n').filter(e => e.trim()));
    }
  }

  return entries;
}

async function generatePattern(options) {
  const entries = [];
  const baseWords = (options.baseWords || '').split('\n').filter(w => w.trim());

  for (const word of baseWords) {
    entries.push(word);

    if (options.includeUppercase) {
      entries.push(word.toUpperCase());
      entries.push(word.charAt(0).toUpperCase() + word.slice(1));
    }

    if (options.includeNumbers) {
      for (let i = 0; i < 10; i++) {
        entries.push(word + i);
        entries.push(i + word);
      }
      entries.push(word + '123');
      entries.push(word + '2024');
    }

    if (options.includeSpecialChars) {
      const specialChars = ['!', '@', '#', '$', '*'];
      for (const char of specialChars) {
        entries.push(word + char);
        entries.push(char + word);
      }
    }

    // Apply pattern if provided
    if (options.pattern) {
      const pattern = options.pattern;
      if (pattern.includes('{word}')) {
        if (pattern.includes('{number}')) {
          for (let i = 0; i < 100; i++) {
            entries.push(pattern.replace('{word}', word).replace('{number}', i));
          }
        } else if (pattern.includes('{year}')) {
          for (let year = 2020; year <= 2024; year++) {
            entries.push(pattern.replace('{word}', word).replace('{year}', year));
          }
        } else {
          entries.push(pattern.replace('{word}', word));
        }
      }
    }
  }

  // Filter by length
  const minLength = options.minLength || 0;
  const maxLength = options.maxLength || 1000;
  
  return entries.filter(e => e.length >= minLength && e.length <= maxLength);
}

// Scan wordlists directory
router.post('/scan', authMiddleware, async (req, res) => {
  try {
    const wordlistsPath = process.env.WORDLISTS_PATH || path.join(__dirname, '../../../wordlists');
    
    // Check if directory exists
    try {
      await fs.access(wordlistsPath);
    } catch {
      return res.json({ message: 'Wordlists directory not found', wordlists: [] });
    }
    
    const files = await fs.readdir(wordlistsPath);
    const wordlistFiles = files.filter(f => f.endsWith('.txt'));
    
    for (const file of wordlistFiles) {
      const filePath = path.join(wordlistsPath, file);
      const stats = await fs.stat(filePath);
      
      // Count lines
      const content = await fs.readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;
      
      // Check if already in database
      const existing = await get('SELECT id FROM wordlists WHERE name = ?', [file]);
      
      if (!existing) {
        await run(
          `INSERT INTO wordlists (name, type, path, size, line_count)
           VALUES (?, ?, ?, ?, ?)`,
          [file, 'password', filePath, stats.size, lineCount]
        );
      }
    }
    
    const wordlists = await all('SELECT * FROM wordlists');
    res.json({ message: 'Wordlists scanned successfully', wordlists });
  } catch (error) {
    console.error('Error scanning wordlists:', error);
    res.status(500).json({ error: 'Failed to scan wordlists' });
  }
});

module.exports = router;
