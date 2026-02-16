
const express = require('express');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const app = express();
const PORT = process.env.PORT || 8080;

// Helper to find the actual file on disk
const resolveFile = (urlPath) => {
  const fullPath = path.join(__dirname, urlPath);
  
  // 1. Check if the file exists exactly as requested
  if (fs.existsSync(fullPath) && !fs.lstatSync(fullPath).isDirectory()) return fullPath;
  
  // 2. Check with .tsx extension
  if (fs.existsSync(fullPath + '.tsx')) return fullPath + '.tsx';
  
  // 3. Check with .ts extension
  if (fs.existsSync(fullPath + '.ts')) return fullPath + '.ts';
  
  return null;
};

// Transpilation Middleware
app.get('*', async (req, res, next) => {
  // We only care about potential TS/TSX files or JavaScript-intended requests
  const isIndex = req.path === '/' || req.path === '/index.html';
  if (isIndex) return next();

  const targetFile = resolveFile(req.path);
  
  if (targetFile && (targetFile.endsWith('.tsx') || targetFile.endsWith('.ts'))) {
    try {
      const source = fs.readFileSync(targetFile, 'utf8');
      const result = await esbuild.transform(source, {
        loader: targetFile.endsWith('.tsx') ? 'tsx' : 'ts',
        target: 'es2020',
        format: 'esm',
        // This helps browser-side React 18/19 compatibility
        jsx: 'automatic', 
      });
      
      res.setHeader('Content-Type', 'application/javascript');
      return res.send(result.code);
    } catch (err) {
      console.error(`Transpilation error for ${targetFile}:`, err);
      return res.status(500).send(`Transpilation Error: ${err.message}`);
    }
  }
  
  next();
});

// Middleware to inject API key into index.html
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading index.html');
    const apiKey = process.env.API_KEY || '';
    const result = data.replace('__API_KEY_PLACEHOLDER__', apiKey);
    res.send(result);
  });
});

// Serve static assets
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Living Lexicon Logic Core online at port ${PORT}`);
});
