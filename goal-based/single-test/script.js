/**
 * PDFPreview - A modern vanilla JavaScript plugin for rendering PDF-like pages from JSON data
 * 
 * @version 2.0.0
 * @author PDF Preview Team
 * 
 * Usage:
 *   PDFPreview.init({
 *     container: '#pdf-root',
 *     data: myData,
 *     toolbar: {
 *       enabled: true,
 *       showBack: true,
 *       showEdit: true,
 *       showHomework: true,
 *       showDownload: true
 *     },
 *     onLoad: function() { console.log('PDF loaded'); },
 *     onBack: function() { console.log('Back clicked'); },
 *     onHomework: function(data) { console.log('Homework clicked', data); },
 *     onDataSaved: function(newData, oldData) { console.log('Data saved', newData, oldData); }
 *   });
 */

(function(window, document) {
	'use strict';
	
	const LETTERS = ['A', 'B', 'C', 'D', 'E'];
	
	// Default configuration
	const defaultConfig = {
		container: '#pdf-root',
		data: null,
		autoLoad: 'data.json',
		toolbar: {
			enabled: true,
			showBack: true,
			showEdit: true,
			showHomework: true,
			showDownload: true,
			title: 'PDF Oluştur'
		},
		modal: {
			enabled: true,
			title: 'Test Bilgilerini Düzenle',
			// If true, plugin will open the edit modal automatically the first time the
			// HTML page is loaded. Control persistence with openOnFirstLoadStorage:
			// - 'session' (per-tab; cleared when the tab closes)
			// - 'local' (persists across sessions/tabs)
			// - 'none' (no persistence; auto-open only once per full page load)
			openOnFirstLoad: false,
			openOnFirstLoadStorage: 'none'
		},
		export: {
			enabled: true,
			filename: 'hedef-temelli-destek.pdf',
			message: 'PDF hazırlanıyor, lütfen bekleyin...'
		},
		scaling: {
			enabled: true,
			minScale: 0.45
		},
		imageCropping: {
			enabled: true,
			padding: 1,
			bgThreshold: 180,
			alphaThreshold: 16
		},
		// Event callbacks
		onLoad: null,
		onBack: null,
		onHomework: null,
		onDataSaved: null,
		onError: null
	};
	
	// Main plugin object
	const PDFPreview = {
		config: {},
		data: null,
		container: null,
		initialized: false,
		// runtime flag to ensure modal auto-open happens only once per full page load
		_hasAutoOpenedModalOnce: false,
		_isRendering: false,
		_pendingDownload: false,
		
		/**
		 * Initialize the plugin with configuration
		 * @param {Object} options - Configuration options
		 */
		init: function(options = {}) {
			this.config = this._mergeConfig(defaultConfig, options);
			
			try {
				this._setupContainer();
				
				if (this.config.data) {
					this.render(this.config.data);
				} else if (this.config.autoLoad) {
					this._loadData(this.config.autoLoad);
				}
				
				if (this.config.toolbar.enabled) {
					this._createToolbar();
				}
				
				if (this.config.modal.enabled) {
					this._createModal();
					this._initModal();
				}
				
				if (this.config.export.enabled) {
					this._createExportOverlay();
					this._createSuccessOverlay();
				}
				
				this._setupEventListeners();
				this.initialized = true;
				// Return the instance to allow API calls like: const preview = PDFPreview.init(...)
				return this;
				
			} catch (error) {
				this._handleError('Initialization failed', error);
				return null;
			}
		},

		// Public helper: programmatic download
		download: function() {
			if (!this.initialized) return;
			this._exportToPDF();
		},

		// Public helper: open the edit modal programmatically
		openEdit: function() {
			if (!this.initialized) return;
			const editBtn = document.getElementById('edit-meta-btn');
			if (editBtn) editBtn.click();
		},

		// Public helper: trigger homework/send action programmatically
		send: function() {
			if (!this.initialized) return;
			if (this.config.onHomework && typeof this.config.onHomework === 'function') {
				this.config.onHomework(this.data);
			} else {
				// fallback: try to trigger the button
				const hw = document.getElementById('send-homework-btn') || document.getElementById('mobile-homework-icon-btn') || document.getElementById('mobile-homework-btn');
				if (hw) hw.click();
			}
		},
		
		/**
		 * Render PDF with provided data
		 * @param {Object} data - The PDF data
		 */
		render: function(data) {
			if (!data) {
				this._handleError('Render failed', new Error('Data parameter is required'));
				return;
			}
			
			this.data = data;
			window._pdfData = data; // Keep for compatibility
			return this._renderPDF(data, this.container);
		},
		
		/**
		 * Update configuration
		 * @param {Object} newConfig - New configuration options
		 */
		updateConfig: function(newConfig) {
			this.config = this._mergeConfig(this.config, newConfig);
			return this;
		},
		
		/**
		 * Destroy the plugin instance
		 */
		destroy: function() {
			if (this.container) {
				this.container.innerHTML = '';
			}
			this._removeEventListeners();
			this.initialized = false;
			this.data = null;
		},
		
		// Private methods
		_mergeConfig: function(defaults, options) {
			const merged = JSON.parse(JSON.stringify(defaults));
			for (const key in options) {
				if (options.hasOwnProperty(key)) {
					if (typeof options[key] === 'object' && options[key] !== null && !Array.isArray(options[key])) {
						merged[key] = this._mergeConfig(merged[key] || {}, options[key]);
					} else {
						merged[key] = options[key];
					}
				}
			}
			return merged;
		},
		
		_setupContainer: function() {
			const containerSelector = this.config.container;
			this.container = typeof containerSelector === 'string' 
				? document.querySelector(containerSelector) 
				: containerSelector;
				
			if (!this.container) {
				throw new Error(`Container not found: ${containerSelector}`);
			}
		},
		
		_loadData: function(url) {
			const self = this;
			fetch(url)
				.then(response => response.json())
				.then(data => self.render(data))
				.catch(error => self._handleError('Failed to load data', error));
		},
		
		_handleError: function(message, error) {
			console.error(`PDFPreview: ${message}`, error);
			if (this.config.onError && typeof this.config.onError === 'function') {
				this.config.onError(message, error);
			}
		},
		
		// Core rendering methods
		_renderPDF: function(data, rootElement) {
			const self = this;
			if (!rootElement) {
				this._handleError('Render failed', new Error('No root element provided'));
				return;
			}
			
			// Mark rendering as in progress
			this._isRendering = true;
			
			// Initialize theme based on test type
			this._initializeTheme(data);
			
			rootElement.innerHTML = '';
			
			// Create first page and append
			const firstPage = this._createFirstPage(data);
			rootElement.appendChild(firstPage);
			
			// Initialize QR code area
			try { 
				this._initQRCodeOnPage(firstPage, data); 
			} catch (e) { 
				console.warn('QR code initialization failed', e);
			}

			const pagesState = {
				data,
				pages: [firstPage],
				pageCount: 1,
				currentPage: firstPage,
				currentColumn: 'left'
			};

			// Place questions sequentially
			const questions = Array.isArray(data.questions) ? data.questions : [];
			
			// Use a promise chain to handle async placement
			let placementPromise = Promise.resolve();
			questions.forEach(function(question) {
				placementPromise = placementPromise.then(function() {
					return self._placeQuestion(rootElement, pagesState, question);
				});
			});
			
			placementPromise.then(function() {
				// Append answer key page
				const answerPage = self._buildAnswerKey(data);
				rootElement.appendChild(answerPage);
				pagesState.pages.push(answerPage);

				// Set page numbers for all pages
				self._setPageNumbers(rootElement);

				// Apply Turkish-aware casing transforms
				self._applyLocaleTransforms(rootElement);

				// Scale pages to fit viewport on small screens
				if (self.config.scaling.enabled) {
					self._scalePagesToFit();
				}

				// Mark rendering as complete
				self._isRendering = false;
				
				// If a download was requested during rendering, execute it now
				if (self._pendingDownload) {
					self._pendingDownload = false;
					self._exportToPDF();
				}

				// Auto-open modal on first load (configurable)
				try {
					if (self.config.modal && self.config.modal.openOnFirstLoad && !self._hasAutoOpenedModalOnce) {
						const storageMode = String(self.config.modal.openOnFirstLoadStorage || 'session').toLowerCase();
						const key = 'pdfpreview_modal_shown_v1';
						let shown = false;
						try {
							if (storageMode === 'local') {
								shown = !!localStorage.getItem(key);
							} else if (storageMode === 'session') {
								shown = !!sessionStorage.getItem(key);
							} else {
								// 'none' or any other value -> do not persist, only in-memory
								shown = false;
							}
						} catch (e) {
							shown = false; // storage unavailable -> fall back to in-memory only
						}
						if (!shown) {
							const editBtn = document.getElementById('edit-meta-btn');
							if (editBtn) {
								editBtn.click();
								self._hasAutoOpenedModalOnce = true;
								try {
									if (storageMode === 'local') localStorage.setItem(key, '1');
									else if (storageMode === 'session') sessionStorage.setItem(key, '1');
								} catch (e) { /* ignore storage errors */ }
							}
						}
					}
				} catch (e) {
					console.warn('auto-open modal error', e);
				}

				// Trigger onLoad callback after all initialization is complete
				if (self.config.onLoad && typeof self.config.onLoad === 'function') {
					try {
						self.config.onLoad(self.data, pagesState.pages);
					} catch (e) {
						console.warn('Error in onLoad callback:', e);
					}
				}
			});
		},

		// Theme management for dynamic color changing based on test type
		_applyTheme: function(testType) {
			const body = document.body;
			
			// Remove existing theme classes
			body.classList.remove('theme-tyt', 'theme-ayt', 'theme-ydt');
			
			// Apply new theme class based on test type
			if (testType) {
				const themeClass = `theme-${testType.toLowerCase()}`;
				body.classList.add(themeClass);
			} else {
				// Default to TYT theme if no test type specified
				body.classList.add('theme-tyt');
			}
		},
		
		_initializeTheme: function(data) {
			if (data && data.testType) {
				this._applyTheme(data.testType);
			} else {
				this._applyTheme('tyt'); // default
			}
		},

		// QR initializer: prefer local QRious (qrious.min.js) if loaded, otherwise fallback to external image
		_initQRCodeOnPage: function(page, data) {
			try {
				const qrContainer = page.querySelector('.first-page-bar .qr-code');
				if (!qrContainer) return;
				qrContainer.innerHTML = '';

				if (!data || !data.qrCodeUrl) return;

				// create canvas to render QR
				const canvas = document.createElement('canvas');
				canvas.style.width = '100%';
				canvas.style.height = '100%';
				qrContainer.appendChild(canvas);

				if (window.QRious) {
					// use QRious if available (local script included in index.html)
					new QRious({ element: canvas, value: String(data.qrCodeUrl), size: 256 });
				} else {
					// fallback: external QR image (reliable) — only used if QRious not present
					const img = document.createElement('img');
					img.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(String(data.qrCodeUrl))}`;
					img.style.width = '100%';
					img.style.height = '100%';
					qrContainer.innerHTML = '';
					qrContainer.appendChild(img);
				}
			} catch (e) {
				console.error('initQRCodeOnPage error', e);
			}
		},

		_qs: function(sel, root) { 
			return (root || document).querySelector(sel); 
		},

		_createEl: function(tag, cls, attrs) {
			const el = document.createElement(tag);
			if (cls) el.className = cls;
			if (attrs) {
				Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
			}
			return el;
		},

		_escapeHtml: function(s) {
			if (!s) return '';
			return String(s).replace(/[&<>"']/g, function (c) {
				return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[c];
			});
		},

		_createFirstPage: function(data) {
			const page = this._createEl('div', 'page odd first-page');
			
			// Build the first-page-bar content conditionally
			let firstPageBarContent = '';
			if (!data.hideLessonName) {
				firstPageBarContent += `<span class="lesson-name">${this._escapeHtml(data.lessonName || 'ders adı')}</span>`;
			}else{
				firstPageBarContent += `<span class="lesson-name" style="visibility:hidden;">ders adı</span>`;
			}
		if (!data.hideSubjectName) {
			firstPageBarContent += `<span class="subject-name">${this._escapeHtml(data.subjectName || 'konu adı')}</span>`;
		}
		// Add QR code with shadow element for better PDF rendering
		firstPageBarContent += `
			<div class="qr-code-wrapper">
				<div class="qr-code-shadow"></div>
				<div class="qr-code"><img src="${this._escapeHtml(data.qrCodeUrl || '')}"></div>
			</div>
		`;			page.innerHTML = `
				<div class="header">
					<img src="images/mebi.png" alt="MEBİ Logo" class="mebi_logo">
					<img src="images/stripes.png" class="stripes">
					<div class="header-ribbon"></div>
					<div class="test-type">${this._escapeHtml(data.testType || '')}</div>
					<span class="page-title">HEDEF TEMELLİ DESTEK EĞİTİMİ</span>
					<span class="first-page-subtitle">${this._escapeHtml(data.schoolName || 'okul adı')}</span>
					<div class="first-page-bar">
						${firstPageBarContent}
					</div>
				</div>
				<div class="content">
					<div class="left-column"></div>
					<div class="divider">
						<div class="divider-text">MEBİ Hedef Temelli Destek Eğitimi</div>
					</div>
					<div class="right-column"></div>
				</div>
				<div class="footer">
					<div class="ogm-title">Ortaöğretim Genel Müdürlüğü</div>
					<div class="page-number"></div>
					<div class="ogm-ribbon"></div>
					<div class="page-number-ribbon"></div>
					<img src="images/stripes.png" class="stripes">
					<div class="footer-disclaimer">
						Bu sayfada bulunan içeriklerin tüm yayın hakları Millî Eğitim Bakanlığı'na aittir. Hiçbir şekilde ticari amaçla kullanılamaz veya kullandırılamaz. Bu sayfada yer alan içeriğin ticari amaçla kullanılması, 5846 sayılı Fikir ve Sanat Eserleri Yasası'nın 36. maddesine aykırıdır ve açıkça suçtur. Aykırı davrananlar hakkında, hukuki ve cezai her türlü başvuru hakkı saklıdır.
					</div>
				</div>
			`;
			// set school name in title area
			const subtitle = this._qs('.first-page-subtitle', page);
			if (subtitle) subtitle.textContent = data.schoolName || 'okul adı';

			return page;
		},

		_createNormalPage: function(isOdd, data) {
			const cls = 'page ' + (isOdd ? 'odd' : 'even');
			const page = this._createEl('div', cls);
			
			// Build the page-bar content conditionally
			let pageBarContent = '';
			if (!data.hideSubjectName) {
				pageBarContent = `<span class="subject-name">${this._escapeHtml(data.subjectName || 'konu adı')}</span>`;
			}
			
			page.innerHTML = `
				<div class="header">
					<span class="page-title">HEDEF TEMELLİ DESTEK EĞİTİMİ</span>
					<img src="images/mebi.png" alt="MEBİ Logo" class="mebi_logo">
					<img src="images/stripes.png" class="stripes">
					<div class="page-bar">
						${pageBarContent}
					</div>
				</div>
				<div class="content">
					<div class="left-column"></div>
					<div class="divider">
						<div class="divider-text">MEBİ Hedef Temelli Destek Eğitimi</div>
					</div>
					<div class="right-column"></div>
				</div>
				<div class="footer">
					<div class="ogm-title">Ortaöğretim Genel Müdürlüğü</div>
					<div class="ogm-ribbon"></div>
					<div class="page-number-ribbon"></div>
					<div class="page-number"></div>
					<img src="images/stripes.png" class="stripes">
					<div class="footer-disclaimer">
						Bu sayfada bulunan içeriklerin tüm yayın hakları Millî Eğitim Bakanlığı'na aittir. Hiçbir şekilde ticari amaçla kullanılamaz veya kullandırılamaz. Bu sayfada yer alan içeriğin ticari amaçla kullanılması, 5846 sayılı Fikir ve Sanat Eserleri Yasası'nın 36. maddesine aykırıdır ve açıkça suçtur. Aykırı davrananlar hakkında, hukuki ve cezai her türlü başvuru hakkı saklıdır.
					</div>
				</div>
			`;
			return page;
		},

		_createQuestionElement: function(q) {
			// create structure but don't set src yet — we'll crop the image first
			const wrapper = this._createEl('div', 'question');
			const num = this._createEl('div', 'question-number');
			num.textContent = q.questionNumber != null ? q.questionNumber + '.' : '';
			const img = this._createEl('img', 'question-image');
			// ensure aspect ratio preserved
			img.style.width = '100%';
			img.style.height = 'auto';
			wrapper.appendChild(num);
			wrapper.appendChild(img);
			return { wrapper, img, originalSrc: q.imageUrl || '' };
		},

		// Crop whitespace around an image by drawing it to a canvas and trimming background
		_cropImageWhitespace: function(src, options) {
			const self = this;
			options = options || {};
			const padding = typeof options.padding === 'number' ? options.padding : this.config.imageCropping.padding;
			const bgThreshold = typeof options.bgThreshold === 'number' ? options.bgThreshold : this.config.imageCropping.bgThreshold;
			const alphaThreshold = typeof options.alphaThreshold === 'number' ? options.alphaThreshold : this.config.imageCropping.alphaThreshold;

			return new Promise(function(resolve) {
				if (!src || !self.config.imageCropping.enabled) return resolve(src);
				const img = new Image();
				img.crossOrigin = 'Anonymous';
				let cleaned = false;
				let timer = null;

				const finish = function(resultSrc) {
					if (!cleaned) {
						cleaned = true;
						try { if (timer) clearTimeout(timer); } catch (e) { }
						resolve(resultSrc);
					}
				};

				img.onload = function() {
					try {
						const w = img.naturalWidth || img.width;
						const h = img.naturalHeight || img.height;
						if (!w || !h) return finish(src);

						const canvas = document.createElement('canvas');
						canvas.width = w;
						canvas.height = h;
						const ctx = canvas.getContext('2d');
						if (ctx) {
							ctx.imageSmoothingEnabled = false;
						}
						ctx.drawImage(img, 0, 0, w, h);
						let data;
						try { 
							data = ctx.getImageData(0, 0, w, h).data; 
						} catch (e) { 
							return finish(src); 
						}

						// Helper function to check if a pixel is "white" (background)
						const isWhitePixel = function(r, g, b, a) {
							return a <= alphaThreshold || (r >= bgThreshold && g >= bgThreshold && b >= bgThreshold);
						};

						// Progressive trimming: keep removing edges until we hit non-white pixels
						let minX = 0, minY = 0, maxX = w - 1, maxY = h - 1;

						// Trim from left
						let foundContent = false;
						for (let x = 0; x < w && !foundContent; x++) {
							for (let y = 0; y < h; y++) {
								const i = (y * w + x) * 4;
								const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
								if (!isWhitePixel(r, g, b, a)) {
									minX = x;
									foundContent = true;
									break;
								}
							}
						}

						// Trim from right
						foundContent = false;
						for (let x = w - 1; x >= minX && !foundContent; x--) {
							for (let y = 0; y < h; y++) {
								const i = (y * w + x) * 4;
								const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
								if (!isWhitePixel(r, g, b, a)) {
									maxX = x;
									foundContent = true;
									break;
								}
							}
						}

						// Trim from top
						foundContent = false;
						for (let y = 0; y < h && !foundContent; y++) {
							for (let x = minX; x <= maxX; x++) {
								const i = (y * w + x) * 4;
								const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
								if (!isWhitePixel(r, g, b, a)) {
									minY = y;
									foundContent = true;
									break;
								}
							}
						}

						// Trim from bottom
						foundContent = false;
						for (let y = h - 1; y >= minY && !foundContent; y--) {
							for (let x = minX; x <= maxX; x++) {
								const i = (y * w + x) * 4;
								const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
								if (!isWhitePixel(r, g, b, a)) {
									maxY = y;
									foundContent = true;
									break;
								}
							}
						}

						// Validate bounds
						if (minX > maxX || minY > maxY || minX >= w || minY >= h) {
							return finish(src);
						}

						const cw = maxX - minX + 1;
						const ch = maxY - minY + 1;

						const out = document.createElement('canvas');
						out.width = cw;
						out.height = ch;
						const outCtx = out.getContext('2d');
						if (outCtx) {
							outCtx.imageSmoothingEnabled = false;
						}
						outCtx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

						// Export as blob
						try {
							out.toBlob(function(blob) {
								if (!blob) return finish(src);
								const url = URL.createObjectURL(blob);
								return finish(url);
							}, 'image/png');
							return;
						} catch (e) {
							// fallback to dataURL
							try {
								const dataUrl = out.toDataURL('image/png');
								return finish(dataUrl);
							} catch (er) {
								return finish(src);
							}
						}
					} catch (e) {
						return finish(src);
					}
				};

				img.onerror = function() {
					finish(src);
				};

				// safety timeout
				timer = setTimeout(function() { finish(src); }, 3000);
				img.decoding = 'async';
				img.src = src;
			});
		},

		// Apply locale-aware transforms for elements that rely on CSS text-transform
		_applyLocaleTransforms: function(root) {
			try {
				const elements = Array.from((root && root.querySelectorAll) ? root.querySelectorAll('*') : []);
				// include root itself
				if (root && root.nodeType === 1) elements.unshift(root);

				elements.forEach(function(el) {
					const cs = window.getComputedStyle(el);
					const t = (cs && cs.textTransform) ? cs.textTransform : 'none';
					if (!t || t === 'none') return;

					// preserve original HTML the first time
					if (!el.hasAttribute('data-original-html')) {
						el.setAttribute('data-original-html', el.innerHTML);
					}
					const originalHtml = el.getAttribute('data-original-html') || el.innerHTML;

					// Use a temporary container
					const tmp = document.createElement('div');
					tmp.innerHTML = originalHtml;

					const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null, false);
					const textNodes = [];
					while (walker.nextNode()) textNodes.push(walker.currentNode);

					textNodes.forEach(function(node) {
						const val = node.nodeValue || '';
						if (!val.trim()) return;
						let out = val;
						if (t === 'uppercase') {
							out = val.toLocaleUpperCase('tr');
						} else if (t === 'lowercase') {
							out = val.toLocaleLowerCase('tr');
						} else if (t === 'capitalize') {
							out = val.split(/(\s+)/).map(function(part) {
								if (/^\s+$/.test(part)) return part;
								const first = part.charAt(0).toLocaleUpperCase('tr');
								const rest = part.slice(1).toLocaleLowerCase('tr');
								return first + rest;
							}).join('');
						}
						if (out !== val) node.nodeValue = out;
					});

					el.innerHTML = tmp.innerHTML;
				});
			} catch (e) {
				console.warn('applyLocaleTransforms error', e);
			}
		},

		// check whether element overflows its container vertically
		_isOverflowing: function(container) {
			return container.scrollHeight > container.clientHeight + 1;
		},

		// place a single question into columns/pages
		_placeQuestion: function(root, pagesState, q) {
			const self = this;
			
			const placeInColumn = function(pageEl, colSelector, questionEl) {
				const col = self._qs(colSelector, pageEl);
				col.appendChild(questionEl.wrapper);
			};

			const ensureImageLoaded = function(img) {
				return new Promise(function(resolve) {
					if (img.complete && img.naturalHeight !== 0) return resolve();
					img.addEventListener('load', function() { resolve(); }, { once: true });
					img.addEventListener('error', function() { resolve(); }, { once: true });
					setTimeout(resolve, 1500);
				});
			};

			return new Promise(function(resolve) {
				let placed = false;
				let attemptColumn = pagesState.currentColumn;

				const tryPlacement = function() {
					if (placed) return resolve();
					
					const pageEl = pagesState.currentPage;
					const colSelector = attemptColumn === 'left' ? '.left-column' : '.right-column';
					
					// create element, crop the source and set src before appending
					const questionEl = self._createQuestionElement(q);
					
					self._cropImageWhitespace(questionEl.originalSrc).then(function(croppedSrc) {
						const finalSrc = croppedSrc || questionEl.originalSrc;
						questionEl.img.src = finalSrc;

						// debugging markers
						try {
							if (questionEl.wrapper && typeof questionEl.wrapper.setAttribute === 'function') {
								if (croppedSrc && (String(croppedSrc).startsWith('data:') || String(croppedSrc).startsWith('blob:'))) {
									questionEl.wrapper.setAttribute('data-cropped', 'yes');
									questionEl.wrapper.setAttribute('data-cropped-src', croppedSrc.startsWith('blob:') ? 'blob' : 'data');
								} else {
									questionEl.wrapper.setAttribute('data-cropped', 'no');
									questionEl.wrapper.setAttribute('data-cropped-src', 'remote');
								}
							}
						} catch (e) {
							console.warn('Error setting debug attributes:', e);
						}
						
						placeInColumn(pageEl, colSelector, questionEl);

						// wait for image to load
						ensureImageLoaded(questionEl.img).then(function() {
							const colNode = self._qs(colSelector, pageEl);
							if (!self._isOverflowing(colNode)) {
								// fits in this column
								placed = true;
								pagesState.currentColumn = attemptColumn;
								return resolve();
							}

							// doesn't fit; remove and try next
							questionEl.wrapper.remove();
							if (attemptColumn === 'left') {
								attemptColumn = 'right';
								tryPlacement();
							} else {
								// both columns full -> create new page
								const newIsOdd = ((pagesState.pageCount + 1) % 2) === 1;
								const newPage = self._createNormalPage(newIsOdd, pagesState.data);
								root.appendChild(newPage);
								pagesState.pages.push(newPage);
								pagesState.pageCount += 1;
								pagesState.currentPage = newPage;
								pagesState.currentColumn = 'left';
								attemptColumn = 'left';
								tryPlacement();
							}
						});
					});
				};

				tryPlacement();
			});
		},

		_setPageNumbers: function(root) {
			const self = this;
			const pages = Array.from(root.querySelectorAll('.page'));
			pages.forEach(function(p, idx) {
				const pn = self._qs('.page-number', p);
				if (pn) pn.textContent = String(idx + 1);
			});
		},

		_buildAnswerKey: function(data) {
			const page = this._createEl('div', 'page answer-key');
			page.innerHTML = `
				<div class="content">
					<div class="answer-key-title">CEVAP ANAHTARI</div>
					<div class="answers"></div>
				</div>
			`;
			const answersContainer = this._qs('.answers', page);
			const answers = Array.isArray(data.answers) ? data.answers.slice() : [];
			const questions = Array.isArray(data.questions) ? data.questions.slice() : [];
			const groups = Math.ceil(answers.length / 10) || 1;
			const total = groups * 10;
			
			// create total slots
			for (let i = 0; i < total; i++) {
				const slot = this._createEl('div', 'answer-question');
				const spanNum = this._createEl('span');
				// Only display the question number if a corresponding question exists
				const questionExists = questions.some(q => q.questionNumber === (i + 1));
				spanNum.textContent = questionExists ? (i + 1) + '.' : '';
				const spanChoice = this._createEl('span');
				const ans = answers.find(a => a.questionNumber === (i + 1));
				if (ans && typeof ans.correctChoiceIndex === 'number') {
					const idx = ans.correctChoiceIndex;
					spanChoice.textContent = LETTERS[idx] || '';
				} else {
					spanChoice.textContent = '';
				}
				slot.appendChild(spanNum);
				slot.appendChild(spanChoice);
				answersContainer.appendChild(slot);
			}
			return page;
		},

		// Scale pages so their A4 proportions remain intact but fit into narrow viewports
		_scalePagesToFit: function() {
			try {
				const pages = Array.from(document.querySelectorAll('.page'));
				if (!pages.length) return;
				
				const root = this.container || document.body;
				const rootStyles = window.getComputedStyle(root);
				const rootPaddingLeft = parseFloat(rootStyles.paddingLeft || 0);
				const rootPaddingRight = parseFloat(rootStyles.paddingRight || 0);
				const rootWidth = root.clientWidth - rootPaddingLeft - rootPaddingRight;

				// Only apply scaling on small screens
				if (rootWidth > 900) {
					pages.forEach(function(p) {
						const parent = p.parentElement;
						if (parent && parent.classList.contains('page-wrap')) {
							parent.parentNode.insertBefore(p, parent);
							parent.remove();
						}
						p.style.transform = '';
						p.style.margin = '';
					});
					return;
				}

				const available = Math.max(1, rootWidth - 8);
				const minScale = this.config.scaling.minScale;

				pages.forEach(function(p) {
					let wrapper = p.parentElement;
					if (!wrapper || !wrapper.classList.contains('page-wrap')) {
						wrapper = document.createElement('div');
						wrapper.className = 'page-wrap';
						p.parentNode.insertBefore(wrapper, p);
						wrapper.appendChild(p);
					}

					const cs = window.getComputedStyle(p);
					const marginTop = parseFloat(cs.marginTop || 0);
					const marginBottom = parseFloat(cs.marginBottom || 0);
					
					p.style.transform = 'none';
					p.style.margin = '0';
					const naturalW = Math.max(1, p.getBoundingClientRect().width);
					const naturalH = Math.max(1, p.getBoundingClientRect().height);

					let scale = 1;
					if (naturalW > available) {
						scale = available / naturalW;
					}
					scale = Math.max(scale, minScale);

					p.style.transformOrigin = 'top left';
					p.style.transform = `scale(${scale}) translateZ(0)`;

					wrapper.style.width = (naturalW * scale) + 'px';
					wrapper.style.height = (naturalH * scale) + 'px';
					wrapper.style.overflow = 'visible';
					wrapper.style.boxSizing = 'content-box';
					wrapper.style.marginTop = (marginTop * scale) + 'px';
					wrapper.style.marginBottom = (marginBottom * scale) + 'px';
					p.style.margin = '0';
				});
			} catch (e) {
				console.error('scalePagesToFit error', e);
			}
		},

		// Toolbar creation and management
		_createToolbar: function() {
			if (document.querySelector('.top-toolbar') || !this.config.toolbar.enabled) return;
			
			const toolbar = this._createEl('div', 'top-toolbar');
			toolbar.setAttribute('role', 'toolbar');
			toolbar.setAttribute('aria-label', 'Page toolbar');

			const inner = this._createEl('div', 'toolbar-inner');
			
			// Left section
			const leftSection = this._createEl('div', 'toolbar-left');
			
			// Back button
			if (this.config.toolbar.showBack) {
				const backBtn = this._createEl('button', 'btn btn-icon');
				backBtn.id = 'back-btn';
				backBtn.type = 'button';
				backBtn.title = 'Geri';
				backBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M19 12H5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span class="sr-only">Geri</span>`;
				leftSection.appendChild(backBtn);
			}
			
			const title = this._createEl('div', 'toolbar-title');
			title.textContent = this.config.toolbar.title;
			leftSection.appendChild(title);

			// Right section with actions
			const actions = this._createEl('div', 'toolbar-actions');

			// Desktop buttons
			if (this.config.toolbar.showEdit) {
				const editBtn = this._createEl('button', 'btn btn-primary desktop-btn');
				editBtn.id = 'edit-meta-btn';
				editBtn.type = 'button';
				editBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>Düzenle</span>`;
				actions.appendChild(editBtn);
			}

			if (this.config.toolbar.showHomework) {
				const homeworkBtn = this._createEl('button', 'btn btn-secondary desktop-btn');
				homeworkBtn.id = 'send-homework-btn';
				homeworkBtn.type = 'button';
				homeworkBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M22 2L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M22 2L15 22L11 13L2 9L22 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>Ödev olarak Gönder</span>`;
				actions.appendChild(homeworkBtn);
			}

			if (this.config.toolbar.showDownload) {
				const downloadBtn = this._createEl('button', 'btn desktop-btn');
				downloadBtn.id = 'download-pdf-btn';
				downloadBtn.type = 'button';
				downloadBtn.title = 'PDF indir';
				downloadBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M21 21H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span class="sr-only">PDF İndir</span>`;
				actions.appendChild(downloadBtn);
			}

			// Mobile icon-only buttons
			if (this.config.toolbar.showEdit) {
				const mobileEditBtn = this._createEl('button', 'btn btn-icon mobile-btn');
				mobileEditBtn.id = 'mobile-edit-icon-btn';
				mobileEditBtn.type = 'button';
				mobileEditBtn.title = 'Düzenle';
				mobileEditBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span class="sr-only">Düzenle</span>`;
				actions.appendChild(mobileEditBtn);
			}

			if (this.config.toolbar.showHomework) {
				const mobileHomeworkBtn = this._createEl('button', 'btn btn-icon mobile-btn');
				mobileHomeworkBtn.id = 'mobile-homework-icon-btn';
				mobileHomeworkBtn.type = 'button';
				mobileHomeworkBtn.title = 'Ödev olarak Gönder';
				mobileHomeworkBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M22 2L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M22 2L15 22L11 13L2 9L22 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span class="sr-only">Ödev olarak Gönder</span>`;
				actions.appendChild(mobileHomeworkBtn);
			}

			// Mobile menu button (three dots)
			const mobileMenuBtn = this._createEl('button', 'btn btn-icon mobile-btn');
			mobileMenuBtn.id = 'mobile-menu-btn';
			mobileMenuBtn.type = 'button';
			mobileMenuBtn.title = 'Menü';
			mobileMenuBtn.innerHTML = `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
					<circle cx="12" cy="12" r="1" fill="currentColor"/>
					<circle cx="12" cy="5" r="1" fill="currentColor"/>
					<circle cx="12" cy="19" r="1" fill="currentColor"/>
				</svg>
				<span class="sr-only">Menü</span>`;
			actions.appendChild(mobileMenuBtn);

			// Mobile context menu
			const contextMenu = this._createEl('div', 'mobile-context-menu');
			contextMenu.id = 'mobile-context-menu';
			let contextMenuHTML = '';
			
			if (this.config.toolbar.showEdit) {
				contextMenuHTML += `
					<button id="mobile-edit-btn" class="context-menu-item">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span>Düzenle</span>
					</button>`;
			}
			
			if (this.config.toolbar.showHomework) {
				contextMenuHTML += `
					<button id="mobile-homework-btn" class="context-menu-item">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
							<path d="M22 2L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
							<path d="M22 2L15 22L11 13L2 9L22 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span>Ödev olarak Gönder</span>
					</button>`;
			}
			
			if (this.config.toolbar.showDownload) {
				contextMenuHTML += `
					<button id="mobile-download-btn" class="context-menu-item">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
							<path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
							<path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
							<path d="M21 21H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span>PDF İndir</span>
					</button>`;
			}
			
			contextMenu.innerHTML = contextMenuHTML;
			actions.appendChild(contextMenu);

			inner.appendChild(leftSection);
			inner.appendChild(actions);
			toolbar.appendChild(inner);

			// insert at top of body
			document.body.insertBefore(toolbar, document.body.firstChild);
		},

		_createModal: function() {
			if (document.getElementById('edit-modal') || !this.config.modal.enabled) return;

			const modalOverlay = this._createEl('div', 'modal-overlay');
			modalOverlay.id = 'edit-modal';
			modalOverlay.setAttribute('aria-hidden', 'true');

			const modal = this._createEl('div', 'modal');
			modal.setAttribute('role', 'dialog');
			modal.setAttribute('aria-modal', 'true');

			// header
			const header = this._createEl('header', 'modal-header');
			const h3 = this._createEl('h3');
			h3.id = 'edit-modal-title';
			h3.textContent = this.config.modal.title;
			const closeBtn = this._createEl('button', 'modal-close');
			closeBtn.id = 'edit-modal-close';
			closeBtn.type = 'button';
			closeBtn.innerHTML = `
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" fill="currentColor"/>
				</svg>`;
			header.appendChild(h3);
			header.appendChild(closeBtn);

		// body
		const body = this._createEl('div', 'modal-body');
		body.innerHTML = `
			<label>
				Ders Adı
				<input id="input-lessonName" type="text" placeholder="Ders adı">
			</label>
			<label class="checkbox-label">
				<input id="checkbox-hideLessonName" type="checkbox">
				<span>Ders Adını Boş Bırak (Gösterme)</span>
			</label>
			<label>
				Konu
				<input id="input-subjectName" type="text" placeholder="Konu">
			</label>
			<label class="checkbox-label">
				<input id="checkbox-hideSubjectName" type="checkbox">
				<span>Konu Adını Boş Bırak (Gösterme)</span>
			</label>
			<label>
				Test Türü
				<select id="select-testType">
					<!-- options populated dynamically -->
				</select>
			</label>
		`;

		// footer
		const footer = this._createEl('footer', 'modal-footer');
			const cancelBtn = this._createEl('button', 'btn btn-secondary');
			cancelBtn.id = 'modal-cancel';
			cancelBtn.type = 'button';
			cancelBtn.textContent = 'İptal';
			const saveBtn = this._createEl('button', 'btn btn-primary');
			saveBtn.id = 'modal-save';
			saveBtn.type = 'button';
			saveBtn.textContent = 'Kaydet';
			footer.appendChild(cancelBtn);
			footer.appendChild(saveBtn);

			modal.appendChild(header);
			modal.appendChild(body);
			modal.appendChild(footer);
			modalOverlay.appendChild(modal);

			// Insert before pdf-root if available, otherwise append to body
			if (this.container && this.container.parentNode) {
				this.container.parentNode.insertBefore(modalOverlay, this.container);
			} else {
				document.body.appendChild(modalOverlay);
			}
		},

		_createExportOverlay: function() {
			if (document.getElementById('export-overlay') || !this.config.export.enabled) return;
			
			const overlay = this._createEl('div', 'export-overlay');
			overlay.id = 'export-overlay';
			overlay.setAttribute('aria-hidden', 'true');

			const inner = this._createEl('div', 'export-overlay-inner');
			const spinner = this._createEl('div', 'spinner');
			const msg = this._createEl('div', 'export-message');
			msg.textContent = this.config.export.message;
			const progress = this._createEl('div', 'export-progress');
			progress.textContent = '';
			inner.appendChild(spinner);
			inner.appendChild(msg);
			inner.appendChild(progress);
			overlay.appendChild(inner);

			document.body.appendChild(overlay);
		},
		
		_createSuccessOverlay: function() {
			if (document.getElementById('success-overlay')) return;
			
			const overlay = this._createEl('div', 'export-overlay');
			overlay.id = 'success-overlay';
			overlay.setAttribute('aria-hidden', 'true');

			const inner = this._createEl('div', 'export-overlay-inner success-inner');
			
			// Success icon (checkmark)
			const icon = this._createEl('div', 'success-icon');
			icon.innerHTML = `
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
					<path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			`;
			
			const msg = this._createEl('div', 'export-message');
			msg.textContent = 'PDF başarıyla indirildi!';
			
			const button = this._createEl('button', 'btn btn-primary success-button');
			button.textContent = 'Tamam';
			button.type = 'button';
			
			inner.appendChild(icon);
			inner.appendChild(msg);
			inner.appendChild(button);
			overlay.appendChild(inner);

			document.body.appendChild(overlay);
			
			// Add click event to close
			const self = this;
			button.addEventListener('click', function() {
				overlay.setAttribute('aria-hidden', 'true');
				overlay.classList.remove('visible');
			});
			
			// Close on overlay click (outside the inner box)
			overlay.addEventListener('click', function(e) {
				if (e.target === overlay) {
					overlay.setAttribute('aria-hidden', 'true');
					overlay.classList.remove('visible');
				}
			});
		},
		
		_showSuccessOverlay: function() {
			const overlay = document.getElementById('success-overlay');
			if (overlay) {
				overlay.setAttribute('aria-hidden', 'false');
				overlay.classList.add('visible');
			}
		},

		_initModal: function() {
			const self = this;
			const modal = document.getElementById('edit-modal');
			if (!modal) return;

			const editBtn = document.getElementById('edit-meta-btn');
			const closeBtn = document.getElementById('edit-modal-close');
			const cancelBtn = document.getElementById('modal-cancel');
			const saveBtn = document.getElementById('modal-save');

		function openModal() {
			const data = self.data || {};
			
			const inputLesson = document.getElementById('input-lessonName');
			const inputSubject = document.getElementById('input-subjectName');
			const selectTest = document.getElementById('select-testType');
			const checkboxHideLesson = document.getElementById('checkbox-hideLessonName');
			const checkboxHideSubject = document.getElementById('checkbox-hideSubjectName');

			if (inputLesson) inputLesson.value = data.lessonName || '';
			if (inputSubject) inputSubject.value = data.subjectName || '';
			
			// Set checkbox states and disable inputs if hidden
			if (checkboxHideLesson) {
				checkboxHideLesson.checked = data.hideLessonName || false;
				if (inputLesson) inputLesson.disabled = checkboxHideLesson.checked;
			}
			
			if (checkboxHideSubject) {
				checkboxHideSubject.checked = data.hideSubjectName || false;
				if (inputSubject) inputSubject.disabled = checkboxHideSubject.checked;
			}

			// populate select
			if (selectTest) {
				selectTest.innerHTML = '<option value="">(Boş bırak)</option>';
				const types = Array.isArray(data.availableTestTypes) ? data.availableTestTypes : [];
				types.forEach(function(t) {
					const o = document.createElement('option');
					o.value = t;
					o.textContent = String(t).toUpperCase();
					selectTest.appendChild(o);
				});
				selectTest.value = data.testType || '';
			}
			
			// Add event listeners for checkboxes to disable/enable inputs
			if (checkboxHideLesson && inputLesson) {
				checkboxHideLesson.addEventListener('change', function() {
					inputLesson.disabled = this.checked;
					if (this.checked) inputLesson.value = '';
				});
			}
			
			if (checkboxHideSubject && inputSubject) {
				checkboxHideSubject.addEventListener('change', function() {
					inputSubject.disabled = this.checked;
					if (this.checked) inputSubject.value = '';
				});
			}

			modal.setAttribute('aria-hidden', 'false');
			modal.classList.add('open');
			document.body.classList.add('modal-open');
			
			if (inputLesson && !inputLesson.disabled) inputLesson.focus();
		}			function closeModal() {
				modal.setAttribute('aria-hidden', 'true');
				modal.classList.remove('open');
				document.body.classList.remove('modal-open');
			}

		function saveModal() {
			const inputLesson = document.getElementById('input-lessonName');
			const inputSubject = document.getElementById('input-subjectName');
			const selectTest = document.getElementById('select-testType');
			const checkboxHideLesson = document.getElementById('checkbox-hideLessonName');
			const checkboxHideSubject = document.getElementById('checkbox-hideSubjectName');

			const oldData = JSON.parse(JSON.stringify(self.data || {}));
			
			if (inputLesson) self.data.lessonName = inputLesson.value.trim();
			if (inputSubject) self.data.subjectName = inputSubject.value.trim();
			if (selectTest) self.data.testType = selectTest.value || '';
			
			// Save hide states
			if (checkboxHideLesson) self.data.hideLessonName = checkboxHideLesson.checked;
			if (checkboxHideSubject) self.data.hideSubjectName = checkboxHideSubject.checked;

			// Apply theme change
			if (selectTest && selectTest.value !== oldData.testType) {
				self._applyTheme(selectTest.value || 'tyt');
			}

			// Callback
			if (self.config.onDataSaved && typeof self.config.onDataSaved === 'function') {
				self.config.onDataSaved(self.data, oldData);
			}

			// Re-render
			self.render(self.data);
			closeModal();
		}			if (editBtn) editBtn.addEventListener('click', openModal);
			if (closeBtn) closeBtn.addEventListener('click', closeModal);
			if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
			if (saveBtn) saveBtn.addEventListener('click', saveModal);

			// close on outside click or ESC
			modal.addEventListener('click', function(e) {
				if (e.target === modal) closeModal();
			});
			
			document.addEventListener('keydown', function(e) {
				if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
			});
		},

		_setupEventListeners: function() {
			const self = this;

			// Back button
			const backBtn = document.getElementById('back-btn');
			if (backBtn) {
				backBtn.addEventListener('click', function() {
					if (self.config.onBack && typeof self.config.onBack === 'function') {
						self.config.onBack();
					}
				});
			}

			// Homework button
			const homeworkBtn = document.getElementById('send-homework-btn');
			if (homeworkBtn) {
				homeworkBtn.addEventListener('click', function() {
					if (self.config.onHomework && typeof self.config.onHomework === 'function') {
						self.config.onHomework(self.data);
					}
				});
			}

			// Download button
			const downloadBtn = document.getElementById('download-pdf-btn');
			if (downloadBtn) {
				downloadBtn.addEventListener('click', function() {
					self._exportToPDF();
				});
			}

			// Mobile edit button
			const mobileEditBtn = document.getElementById('mobile-edit-icon-btn');
			if (mobileEditBtn) {
				mobileEditBtn.addEventListener('click', function() {
					// Open the modal just like the desktop edit button
					const modal = document.getElementById('edit-modal');
					if (modal) {
						const openModalEvent = new Event('click');
						const editMetaBtn = document.getElementById('edit-meta-btn');
						if (editMetaBtn) {
							editMetaBtn.dispatchEvent(openModalEvent);
						}
					}
				});
			}

			// Mobile homework button
			const mobileHomeworkBtn = document.getElementById('mobile-homework-icon-btn');
			if (mobileHomeworkBtn) {
				mobileHomeworkBtn.addEventListener('click', function() {
					if (self.config.onHomework && typeof self.config.onHomework === 'function') {
						self.config.onHomework(self.data);
					}
				});
			}

			// Mobile menu button
			const mobileMenuBtn = document.getElementById('mobile-menu-btn');
			const mobileContextMenu = document.getElementById('mobile-context-menu');
			if (mobileMenuBtn && mobileContextMenu) {
				mobileMenuBtn.addEventListener('click', function(e) {
					e.stopPropagation();
					const isVisible = mobileContextMenu.classList.contains('show');
					if (isVisible) {
						mobileContextMenu.classList.remove('show');
					} else {
						mobileContextMenu.classList.add('show');
					}
				});

				// Close menu when clicking outside
				document.addEventListener('click', function() {
					mobileContextMenu.classList.remove('show');
				});

				// Prevent menu from closing when clicking inside it
				mobileContextMenu.addEventListener('click', function(e) {
					e.stopPropagation();
				});

				// Context menu download button
				const contextDownloadBtn = mobileContextMenu.querySelector('#mobile-download-btn');
				if (contextDownloadBtn) {
					contextDownloadBtn.addEventListener('click', function() {
						self._exportToPDF();
						mobileContextMenu.classList.remove('show');
					});
				}

				// Context menu edit button
				const contextEditBtn = mobileContextMenu.querySelector('#mobile-edit-btn');
				if (contextEditBtn) {
					contextEditBtn.addEventListener('click', function() {
						// Open the modal just like the desktop edit button
						const modal = document.getElementById('edit-modal');
						if (modal) {
							const openModalEvent = new Event('click');
							const editMetaBtn = document.getElementById('edit-meta-btn');
							if (editMetaBtn) {
								editMetaBtn.dispatchEvent(openModalEvent);
							}
						}
						mobileContextMenu.classList.remove('show');
					});
				}

				// Context menu homework button
				const contextHomeworkBtn = mobileContextMenu.querySelector('#mobile-homework-btn');
				if (contextHomeworkBtn) {
					contextHomeworkBtn.addEventListener('click', function() {
						if (self.config.onHomework && typeof self.config.onHomework === 'function') {
							self.config.onHomework(self.data);
						}
						mobileContextMenu.classList.remove('show');
					});
				}
			}

			// Re-scale on resize
			let scaleTimer = null;
			window.addEventListener('resize', function() {
				if (scaleTimer) clearTimeout(scaleTimer);
				scaleTimer = setTimeout(function() {
					if (self.config.scaling.enabled) {
						self._scalePagesToFit();
					}
				}, 120);
			});
			
			window.addEventListener('orientationchange', function() {
				setTimeout(function() {
					if (self.config.scaling.enabled) {
						self._scalePagesToFit();
					}
				}, 140);
			});
		},

		_removeEventListeners: function() {
			// This is a simplified cleanup - in a full implementation you'd store references
			// to event handlers and remove them properly
		},

		// PDF export functionality
		_exportToPDF: function() {
			const self = this;
			
			// Set download button to loading state and replace icon with spinner
			const downloadBtn = document.getElementById('download-pdf-btn');
			
			const spinnerSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="animation: spin 1s linear infinite">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
				<path d="M 12 2 A 10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
			</svg>`;
			
			if (downloadBtn) {
				downloadBtn.disabled = true;
				downloadBtn.classList.add('loading');
				// Store original icon
				if (!downloadBtn.dataset.originalIcon) {
					downloadBtn.dataset.originalIcon = downloadBtn.querySelector('svg').outerHTML;
				}
				// Replace with spinner
				const svgContainer = downloadBtn.querySelector('svg');
				if (svgContainer) {
					svgContainer.outerHTML = spinnerSVG;
				}
			}
			
			// If rendering is still in progress, queue the download and wait
			if (this._isRendering) {
				this._pendingDownload = true;
				return;
			}
			
			const overlay = document.getElementById('export-overlay');
			
			function showOverlay() {
				if (overlay) {
					overlay.setAttribute('aria-hidden', 'false');
					overlay.classList.add('visible');
				}
			}
			
			function hideOverlay() {
				if (overlay) {
					overlay.setAttribute('aria-hidden', 'true');
					overlay.classList.remove('visible');
				}
			}
			
			function updateOverlayProgress(current, total) {
				if (overlay) {
					const progressText = overlay.querySelector('.export-progress');
					if (progressText) {
						progressText.textContent = 'Sayfa ' + current + ' / ' + total + ' işleniyor...';
					}
				}
			}

			// Check for required libraries
			if (!window.html2canvas) {
				alert('PDF kütüphanesi "html2canvas" yüklenmedi. Lütfen script bağlantılarını kontrol edin.');
				return;
			}

			let jsPDF = null;
			if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
				jsPDF = window.jspdf.jsPDF;
			} else if (window.jsPDF && typeof window.jsPDF === 'function') {
				jsPDF = window.jsPDF;
			}

			if (!jsPDF) {
				alert('PDF kütüphanesi "jsPDF" yüklenmedi. Lütfen script bağlantılarını kontrol edin.');
				return;
			}

			const pages = Array.from(document.querySelectorAll('.page'));
			if (!pages.length) {
				alert('PDF için sayfa bulunamadı.');
				return;
			}

			showOverlay();
			
			// Debugging: Log export start
			console.log('PDF Export Started: ' + pages.length + ' pages total');
			console.log('Device Info:', {
				userAgent: navigator.userAgent,
				devicePixelRatio: window.devicePixelRatio,
				memory: navigator.deviceMemory || 'unknown',
				hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
				screenResolution: window.screen.width + 'x' + window.screen.height
			});

			// Optimal settings for consistent quality across all devices
			const OPTIMAL_SCALE = 3; // High quality baseline
			const USE_PNG = true; // Lossless format
			const CANVAS_TIMEOUT = 10000; // Even more time for slow devices
			const PROCESS_DELAY = 200; // Longer delay between pages for better reliability

			// Small delay to show overlay
			setTimeout(function() {
				const pdf = new jsPDF({ 
					unit: 'mm', 
					format: 'a4', 
					compress: true,
					precision: 16 // Higher precision for better quality
				});
				
				let processIndex = 0;
				let failedAttempts = 0;
				const MAX_RETRIES = 3;
				const processedPages = [];
				const failedPages = [];
				
				function processNextPage() {
					if (processIndex >= pages.length) {
					// All done
					pdf.save(self.config.export.filename);
					hideOverlay();
					
					// Reset download button state and restore original icon
					if (downloadBtn) {
						downloadBtn.disabled = false;
						downloadBtn.classList.remove('loading');
						if (downloadBtn.dataset.originalIcon) {
							const svgContainer = downloadBtn.querySelector('svg');
							if (svgContainer) {
								svgContainer.outerHTML = downloadBtn.dataset.originalIcon;
							}
						}
					}
					
					// Show success overlay after a short delay
					setTimeout(function() {
						self._showSuccessOverlay();
					}, 300);						return;
					}
					
					// Update progress display (after checking if we're done)
					updateOverlayProgress(processIndex + 1, pages.length);
					
					const page = pages[processIndex];
					const pageNumber = processIndex + 1;
					
					console.log('Processing page ' + pageNumber + ' of ' + pages.length);
					
					// Check if page exists and is visible
					if (!page || !page.offsetParent) {
						console.warn('Page ' + pageNumber + ' is not visible or does not exist');
					}
					
					const clone = page.cloneNode(true);
					
					// Copy canvas content from original to clone with high fidelity
					const originalCanvases = page.querySelectorAll('canvas');
					const cloneCanvases = clone.querySelectorAll('canvas');
					
					for (let i = 0; i < originalCanvases.length && i < cloneCanvases.length; i++) {
						try {
							const originalCanvas = originalCanvases[i];
							const cloneCanvas = cloneCanvases[i];
							
							// Preserve original dimensions
							cloneCanvas.width = originalCanvas.width;
							cloneCanvas.height = originalCanvas.height;
							
							// High quality canvas copy
							const cloneCtx = cloneCanvas.getContext('2d', {
								alpha: true,
								desynchronized: false,
								willReadFrequently: false
							});
							
							// Disable smoothing for crisp rendering
							cloneCtx.imageSmoothingEnabled = false;
							cloneCtx.drawImage(originalCanvas, 0, 0);
						} catch (e) {
							console.warn('Could not copy canvas content:', e);
						}
					}
					
					// Position clone off-screen
					clone.style.position = 'fixed';
					clone.style.left = '-10000px';
					clone.style.top = '0';
					clone.style.margin = '0';
					clone.style.transform = 'none';
					clone.style.opacity = '1';
					document.body.appendChild(clone);
					
					// Optimal html2canvas configuration
					const html2canvasOptions = {
						scale: OPTIMAL_SCALE,
						useCORS: true,
						allowTaint: false,
						backgroundColor: '#ffffff',
						imageTimeout: CANVAS_TIMEOUT,
						logging: false,
						// Quality-focused options
						letterRendering: true,
						foreignObjectRendering: false, // More reliable
						removeContainer: false,
						// Window sizing
						windowWidth: clone.scrollWidth,
						windowHeight: clone.scrollHeight,
						// Canvas rendering options
						onclone: function(clonedDoc) {
							// Ensure all canvases are properly copied
							const clonedCanvases = clonedDoc.querySelectorAll('canvas');
							const origCanvases = page.querySelectorAll('canvas');
							
							for (let i = 0; i < origCanvases.length && i < clonedCanvases.length; i++) {
								try {
									const origCanvas = origCanvases[i];
									const clonedCanvas = clonedCanvases[i];
									
									clonedCanvas.width = origCanvas.width;
									clonedCanvas.height = origCanvas.height;
									
									const clonedCtx = clonedCanvas.getContext('2d', {
										alpha: true,
										desynchronized: false
									});
									
									clonedCtx.imageSmoothingEnabled = false;
									clonedCtx.drawImage(origCanvas, 0, 0);
								} catch (e) {
									console.warn('Could not copy canvas in onclone:', e);
								}
							}
							
							// Ensure all images are loaded
							const imgs = clonedDoc.querySelectorAll('img');
							imgs.forEach(function(img) {
								if (!img.complete) {
									// Force reload if not complete
									const src = img.src;
									img.src = '';
									img.src = src;
								}
							});
						}
					};
					
					// Use html2canvas to render
					window.html2canvas(clone, html2canvasOptions)
						.then(function(canvas) {
							console.log('Page ' + pageNumber + ' rendered successfully. Canvas size: ' + canvas.width + 'x' + canvas.height);
							clone.remove();
							
							// Validate canvas
							if (!canvas || canvas.width === 0 || canvas.height === 0) {
								throw new Error('Invalid canvas generated for page ' + pageNumber);
							}
							
							// Convert to high-quality image
							const format = USE_PNG ? 'image/png' : 'image/jpeg';
							const quality = USE_PNG ? 1.0 : 0.98;
							const imgData = canvas.toDataURL(format, quality);
							
							// Validate image data
							if (!imgData || imgData.length < 100) {
								throw new Error('Invalid image data generated for page ' + pageNumber);
							}
							
							const pdfWidth = 210; // mm (A4)
							const pdfHeight = 297; // mm (A4)

							if (processIndex > 0) pdf.addPage();
							
							// Add image with compression options for smaller file size
							const compression = USE_PNG ? 'SLOW' : 'FAST';
							pdf.addImage(
								imgData, 
								USE_PNG ? 'PNG' : 'JPEG', 
								0, 
								0, 
								pdfWidth, 
								pdfHeight,
								undefined,
								compression
							);
							
							console.log('Page ' + pageNumber + ' added to PDF successfully');
							processedPages.push(pageNumber);
							processIndex++;
							failedAttempts = 0; // Reset on success
							
							// Process next page with delay for resource cleanup
							setTimeout(processNextPage, PROCESS_DELAY);
						})
						.catch(function(error) {
							console.error('Error processing page ' + pageNumber, error);
							clone.remove();
							
							// Retry logic for failed pages
							if (failedAttempts < MAX_RETRIES) {
								failedAttempts++;
								console.log('Retrying page ' + pageNumber + ', attempt ' + failedAttempts + ' of ' + MAX_RETRIES);
								setTimeout(processNextPage, PROCESS_DELAY * 3); // Longer delay on retry
							} else {
								// Skip failed page and continue
								console.error('Skipping page ' + pageNumber + ' after ' + MAX_RETRIES + ' attempts');
								failedPages.push(pageNumber);
								processIndex++;
								failedAttempts = 0;
								setTimeout(processNextPage, PROCESS_DELAY);
							}
						});
				}
				
				processNextPage();
			}, 50);
		}
	};

	// Expose the plugin globally
	window.PDFPreview = PDFPreview;

	// Backward compatibility - expose some methods globally
	window.exportPagesToPdf = function(filename) {
		if (PDFPreview.initialized) {
			PDFPreview.config.export.filename = filename || PDFPreview.config.export.filename;
			PDFPreview._exportToPDF();
		}
	};
	
	window.applyTheme = function(testType) {
		if (PDFPreview.initialized) {
			PDFPreview._applyTheme(testType);
		}
	};

})(window, document);