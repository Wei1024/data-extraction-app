import * as pdfjsLib from './node_modules/pdfjs-dist/build/pdf.mjs';
import * as pdfjsViewer from './node_modules/pdfjs-dist/web/pdf_viewer.mjs';

// Initialize PDF.js and set it on the window object
window.pdfjsLib = pdfjsLib;
window.pdfjsViewer = pdfjsViewer;

// Set the worker source
window.pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs'; 