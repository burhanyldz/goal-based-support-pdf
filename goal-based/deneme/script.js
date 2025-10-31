/**
 * DenemePDF - PDF generation for multi-test booklets (TYT/AYT/YDT)
 * 
 * @version 2.0.0
 * @author Deneme Team
 */

(function(window, document) {
	'use strict';
	
	const LETTERS = ['A', 'B', 'C', 'D', 'E'];
	
	// Lesson color mapping
	const LESSON_COLORS = {
		'tur': { primary: '#c37f67', secondary: '#f7a180' },    // Türkçe
		'sos': { primary: '#72a15e', secondary: '#92cc77' },     // Sosyal Bilgiler
		'mat': { primary: '#608ab1', secondary: '#79addd' },    // Matematik
		'fen': { primary: '#91719b', secondary: '#b78bbf' },     // Fen Bilimleri
		'ydt': { primary: '#bd484a', secondary: '#f06061' },     // Yabancı Dil
		'tde-sos': { primary: '#c37f67', secondary: '#f7a180' }, // TDE-Sosyal Bilimler
		'sos2': { primary: '#72a15e', secondary: '#92cc77' },	 // Sosyal Bilimler 2
	};
	
	// Default configuration
	const defaultConfig = {
		container: '#pdf-root',
		examData: null,
		toolbar: {
			enabled: true,
			showBack: true,
			showDownload: true,
			showHomework: true,
			title: 'Deneme Sınavı'
		},
		export: {
			enabled: true,
			filename: 'deneme-sinavi.pdf',
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
		onLoad: null,
		onBack: null,
		onHomework: null,
		onError: null
	};
	
	// Main plugin object
	const DenemePDF = {
		config: {},
		examData: null,
		container: null,
		initialized: false,
		currentTestType: null,
		
		init: function(options = {}) {
			this.config = this._mergeConfig(defaultConfig, options);
			
			try {
				this._setupContainer();
				
				if (this.config.examData) {
					this.render(this.config.examData);
				}
				
				if (this.config.toolbar.enabled) {
					this._createToolbar();
				}
				
				if (this.config.export.enabled) {
					this._createExportOverlay();
					this._createSuccessOverlay();
				}
				
				this._setupEventListeners();
				this.initialized = true;
				return this;
				
			} catch (error) {
				this._handleError('Initialization failed', error);
				return null;
			}
		},

		download: function() {
			if (!this.initialized) return;
			this._exportToPDF();
		},

		send: function() {
			if (!this.initialized) return;
			if (this.config.onHomework && typeof this.config.onHomework === 'function') {
				this.config.onHomework(this.examData);
			}
		},
		
		render: function(examData) {
			if (!examData) {
				this._handleError('Render failed', new Error('examData parameter is required'));
				return;
			}
			
			this.examData = examData;
			window._examData = examData;
			
			return this._renderPDF(examData, this.container);
		},
		
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
		
		_handleError: function(message, error) {
			console.error(`DenemePDF: ${message}`, error);
			if (this.config.onError && typeof this.config.onError === 'function') {
				this.config.onError(message, error);
			}
		},
		
		_renderPDF: function(examData, rootElement) {
			const self = this;
			if (!rootElement) {
				this._handleError('Render failed', new Error('No root element provided'));
				return;
			}
			
			// Determine test type from available test types
			const testType = examData.availableTestTypes && examData.availableTestTypes.length > 0 
				? examData.availableTestTypes[0] 
				: 'tyt';
			
			this.currentTestType = testType;
			this._initializeTheme(testType);
			
			rootElement.innerHTML = '';
			
			// Create cover pages
			const coverPage1 = this._createCoverPage(testType, 1);
			const coverPage2 = this._createCoverPage(testType, 2);
			rootElement.appendChild(coverPage1);
			rootElement.appendChild(coverPage2);
			
			const pagesState = {
				examData,
				pages: [/* coverPage1, coverPage2 */],
				pageCount: 2,
				currentPage: null,
				currentColumn: 'left',
				currentTest: null,
				globalPageNumber: 1 // Start page numbering from 1 for test pages
			};

			// Process each test
			const tests = Array.isArray(examData.tests) ? examData.tests : [];
			
			let renderPromise = Promise.resolve();
			
			tests.forEach(function(test) {
				renderPromise = renderPromise.then(function() {
					return self._renderTest(rootElement, pagesState, test);
				});
			});
			
			renderPromise.then(function() {
				// Create answer key pages for all tests
				const answerPages = self._buildAnswerKeys(examData);
				answerPages.forEach(function(page) {
					rootElement.appendChild(page);
					pagesState.pages.push(page);
				});

				// Apply Turkish-aware casing transforms
				self._applyLocaleTransforms(rootElement);

				// Scale pages to fit viewport on small screens
				if (self.config.scaling.enabled) {
					self._scalePagesToFit();
				}

				// Trigger onLoad callback
				if (self.config.onLoad && typeof self.config.onLoad === 'function') {
					try {
						self.config.onLoad(self.examData, pagesState.pages);
					} catch (e) {
						console.warn('Error in onLoad callback:', e);
					}
				}
			});
		},

		_renderTest: function(rootElement, pagesState, test) {
			const self = this;
			
			// Create first page for this test
			const testColor = LESSON_COLORS[test.lessonCode] || '';
			const firstPage = this._createTestFirstPage(test, pagesState, testColor);
			rootElement.appendChild(firstPage);
			pagesState.pages.push(firstPage);
			pagesState.pageCount += 1;
			pagesState.currentPage = firstPage;
			pagesState.currentColumn = 'left';
			pagesState.currentTest = test;

			// Initialize QR code on first page of each test
			try { 
				this._initQRCodeOnPage(firstPage, pagesState.examData); 
			} catch (e) { 
				console.warn('QR code initialization failed', e);
			}

			// Place questions for this test
			const questions = Array.isArray(test.questions) ? test.questions : [];
			
			let placementPromise = Promise.resolve();
			questions.forEach(function(question) {
				placementPromise = placementPromise.then(function() {
					return self._placeQuestion(rootElement, pagesState, question, testColor, test);
				});
			});
			
			return placementPromise;
		},

		_createCoverPage: function(testType, pageNumber) {
			const page = this._createEl('div', 'page cover-page');
			const imageFilename = `${testType.toLowerCase()}-kapak${pageNumber === 2 ? '2' : ''}.jpg`;
			
			page.innerHTML = `
				<img src="images/${imageFilename}" alt="${testType.toUpperCase()} Kapak ${pageNumber}" class="cover-image">
			`;
			
			return page;
		},

		_createTestFirstPage: function(test, pagesState, testColor) {
			// Compute odd/even based on current page count
			const isOdd = ((pagesState.pageCount + 1) % 2) === 1;
			const pageClass = 'page ' + (isOdd ? 'odd' : 'even') + ' first-page';
			const page = this._createEl('div', pageClass);
			page.setAttribute('data-test-color', testColor.primary);
			
			const testTypeUpper = this.currentTestType ? this.currentTestType.toUpperCase() : '-';
			const testName = test.name || '';
			
			page.innerHTML = `
				<div class="header">
					<div class="test-title" style="color: ${testColor.primary};">${this._escapeHtml(testName).toUpperCase()} TESTİ</div>
                    <div class="test-info-bar" style="border-top: .7mm solid ${testColor.primary}; border-bottom: .7mm solid ${testColor.primary};">
						<div class="dark-ribbon" style="background: ${testColor.primary};"></div>
						<div class="high-ribbon-left" style="background: ${testColor.secondary};"></div>
						<div class="ribbon-extension-left" style="background: ${testColor.secondary};"></div>
						<div class="high-ribbon-right" style="background: ${testColor.primary};"></div>
						<div class="ribbon-extension-right" style="background: ${testColor.primary};"></div>
						<div class="light-ribbon" style="background: ${testColor.secondary};">
							<div>${testTypeUpper}</div>
						</div>
						<div class="test-instructions">
							${this._escapeHtml(test.testInstructions)}
						</div>
                    </div>
                    </div>
				<div class="content">
					<div class="left-column"></div>
					<div class="divider" style="background: ${testColor.secondary};">
						<div class="divider-text" style="color: ${testColor.secondary}; border: 1px solid ${testColor.secondary};">MEBİ Hedef Temelli Destek Eğitimi</div>
					</div>
					<div class="right-column"></div>
				</div>
				<div class="footer">
					<div class="footer-page-number">${pagesState.globalPageNumber}</div>
					<div class="footer-page-number-ribbon" style="background: ${testColor.primary};">
						<div class="light-ribbon" style="background: ${testColor.secondary};"></div>
					</div>
					<div class="footer-test-name">${testTypeUpper} - ${this._escapeHtml(testName).toUpperCase()} TESTİ</div>
				</div>
			`;
			
			pagesState.globalPageNumber++;
			return page;
		},

		_createNormalPage: function(isOdd, pagesState, testColor, test) {
			const cls = 'page ' + (isOdd ? 'odd' : 'even');
			const page = this._createEl('div', cls);
			page.setAttribute('data-test-color', testColor.primary);
			
			const testTypeUpper = this.currentTestType ? this.currentTestType.toUpperCase() : 'TYT';
			const testName = test.name || '';
			
			page.innerHTML = `
				<div class="header">
					<div class="header-left">YKS DENEMELERİ</div>
					<div class="header-center">Ortaöğretim Genel Müdürlüğü</div>
					<div class="header-right">DENEME</div>
				</div>
				<div class="content">
					<div class="left-column"></div>
					<div class="divider" style="background: ${testColor.secondary};">
						<div class="divider-text" style="color: ${testColor.secondary}; border: 1px solid ${testColor.secondary};">MEBİ Hedef Temelli Destek Eğitimi</div>
					</div>
					<div class="right-column"></div>
				</div>
				<div class="footer">
					<div class="footer-page-number">${pagesState.globalPageNumber}</div>
					<div class="footer-page-number-ribbon" style="background: ${testColor.primary};">
						<div class="light-ribbon" style="background: ${testColor.secondary};"></div>
					</div>
					<div class="footer-test-name">${testTypeUpper} - ${this._escapeHtml(testName).toUpperCase()} TESTİ</div>
				</div>
			`;
			
			pagesState.globalPageNumber++;
			return page;
		},

		_initQRCodeOnPage: function(page, examData) {
			// QR code is not shown on deneme pages based on the design
			// Keeping this method for future use if needed
			return;
		},

		// Align helpers with single-test for identical layout behavior
		_isOverflowing: function(container) {
			return container.scrollHeight > container.clientHeight + 1;
		},

		_createQuestionElement: function(q) {
			const wrapper = this._createEl('div', 'question');
			const num = this._createEl('div', 'question-number');
			num.textContent = q.questionNumber != null ? q.questionNumber + '.' : '';
			const img = this._createEl('img', 'question-image');
			// match single-test aspect handling
			img.style.width = '100%';
			img.style.height = 'auto';
			wrapper.appendChild(num);
			wrapper.appendChild(img);
			return { wrapper, img, originalSrc: q.imageUrl || '' };
		},

		_placeQuestion: function(root, pagesState, q, testColor, test) {
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
								const newPage = self._createNormalPage(newIsOdd, pagesState, testColor, test);
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

		_buildAnswerKeys: function(examData) {
			const self = this;
			const tests = Array.isArray(examData.tests) ? examData.tests : [];
			const answerPages = [];
			
			if (tests.length === 0) {
				return answerPages;
			}
			
			// Create a single page for all answer keys
			const page = self._createEl('div', 'page answer-key');
			const content = self._createEl('div', 'content');
			page.appendChild(content);
			
			// Add each test's answer key as a section within the same page
			tests.forEach(function(test) {
				const lessonCode = test.lessonCode || 'tur';
				
				// Create section for this test with lesson-specific class
				const section = self._createEl('div', 'answer-section lesson-' + lessonCode);
				
				// Add title (CSS variables will handle the color)
				const title = self._createEl('div', 'answer-key-title');
				title.textContent = self._escapeHtml(test.name || '').toUpperCase() + ' TESTİ CEVAP ANAHTARI';
				section.appendChild(title);
				
				// Add answers grid
				const answersContainer = self._createEl('div', 'answers');
				const answers = Array.isArray(test.answers) ? test.answers.slice() : [];
				const questions = Array.isArray(test.questions) ? test.questions.slice() : [];
				const maxQuestion = test.maxQuestion || answers.length || 10;
				const groups = Math.ceil(maxQuestion / 10) || 1;
				const total = groups * 10;
				
				for (let i = 0; i < total; i++) {
					const slot = self._createEl('div', 'answer-question');
					const spanNum = self._createEl('span');
					const questionExists = questions.some(q => q.questionNumber === (i + 1));
					spanNum.textContent = questionExists ? (i + 1) + '.' : '';
					const spanChoice = self._createEl('span');
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
				
				section.appendChild(answersContainer);
				content.appendChild(section);
			});
			
			answerPages.push(page);
			
			return answerPages;
		},

		_applyTheme: function(testType) {
			const body = document.body;
			body.classList.remove('theme-tyt', 'theme-ayt', 'theme-ydt');
			
			if (testType) {
				const themeClass = `theme-${testType.toLowerCase()}`;
				body.classList.add(themeClass);
			} else {
				body.classList.add('theme-tyt');
			}
		},
		
		_initializeTheme: function(testType) {
			this._applyTheme(testType || 'tyt');
		},

		_scalePagesToFit: function() {
			try {
				const pages = Array.from(document.querySelectorAll('.page'));
				if (!pages.length) return;
				
				const root = this.container || document.body;
				const rootStyles = window.getComputedStyle(root);
				const rootPaddingLeft = parseFloat(rootStyles.paddingLeft || 0);
				const rootPaddingRight = parseFloat(rootStyles.paddingRight || 0);
				const rootWidth = root.clientWidth - rootPaddingLeft - rootPaddingRight;

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

		_createToolbar: function() {
			if (document.querySelector('.top-toolbar') || !this.config.toolbar.enabled) return;
			
			const toolbar = this._createEl('div', 'top-toolbar');
			toolbar.setAttribute('role', 'toolbar');
			toolbar.setAttribute('aria-label', 'Page toolbar');

			const inner = this._createEl('div', 'toolbar-inner');
			
			const leftSection = this._createEl('div', 'toolbar-left');
			
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

			const actions = this._createEl('div', 'toolbar-actions');

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
				downloadBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>PDF İndir</span>`;
				actions.appendChild(downloadBtn);
			}

			const menuBtn = this._createEl('button', 'btn btn-icon mobile-menu-btn');
			menuBtn.id = 'mobile-menu-btn';
			menuBtn.type = 'button';
			menuBtn.title = 'Menü';
			menuBtn.innerHTML = `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
					<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
					<line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
					<line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
				</svg>
				<span class="sr-only">Menü</span>`;
			actions.appendChild(menuBtn);

			const contextMenu = this._createEl('div', 'mobile-context-menu');
			contextMenu.id = 'mobile-context-menu';
			contextMenu.setAttribute('aria-hidden', 'true');

			if (this.config.toolbar.showHomework) {
				const mobileHomeworkBtn = this._createEl('button', 'btn');
				mobileHomeworkBtn.id = 'mobile-homework-btn';
				mobileHomeworkBtn.type = 'button';
				mobileHomeworkBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M22 2L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M22 2L15 22L11 13L2 9L22 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>Ödev olarak Gönder</span>`;
				contextMenu.appendChild(mobileHomeworkBtn);
			}

			if (this.config.toolbar.showDownload) {
				const mobileDownloadBtn = this._createEl('button', 'btn');
				mobileDownloadBtn.id = 'mobile-download-btn';
				mobileDownloadBtn.type = 'button';
				mobileDownloadBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>PDF İndir</span>`;
				contextMenu.appendChild(mobileDownloadBtn);
			}

			actions.appendChild(contextMenu);

			inner.appendChild(leftSection);
			inner.appendChild(actions);
			toolbar.appendChild(inner);

			document.body.insertBefore(toolbar, document.body.firstChild);
		},

		_createExportOverlay: function() {
			if (document.getElementById('export-overlay')) return;
			
			const overlay = this._createEl('div', 'export-overlay');
			overlay.id = 'export-overlay';
			overlay.setAttribute('aria-hidden', 'true');

			const inner = this._createEl('div', 'export-overlay-inner');
			
			const spinner = this._createEl('div', 'spinner');
			const msg = this._createEl('div', 'export-message');
			msg.textContent = this.config.export.message;
			
			const progress = this._createEl('div', 'export-progress');
			progress.innerHTML = '<div class="export-progress-bar"></div>';

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
			
			const self = this;
			button.addEventListener('click', function() {
				overlay.setAttribute('aria-hidden', 'true');
				overlay.classList.remove('visible');
			});
			
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

		_setupEventListeners: function() {
			const self = this;

			const backBtn = document.getElementById('back-btn');
			if (backBtn) {
				backBtn.addEventListener('click', function() {
					if (self.config.onBack && typeof self.config.onBack === 'function') {
						self.config.onBack();
					}
				});
			}

			const homeworkBtn = document.getElementById('send-homework-btn');
			if (homeworkBtn) {
				homeworkBtn.addEventListener('click', function() {
					if (self.config.onHomework && typeof self.config.onHomework === 'function') {
						self.config.onHomework(self.examData);
					}
				});
			}

			const downloadBtn = document.getElementById('download-pdf-btn');
			if (downloadBtn) {
				downloadBtn.addEventListener('click', function() {
					self._exportToPDF();
				});
			}

			const menuBtn = document.getElementById('mobile-menu-btn');
			const contextMenu = document.getElementById('mobile-context-menu');
			if (menuBtn && contextMenu) {
				menuBtn.addEventListener('click', function(e) {
					e.stopPropagation();
					const isHidden = contextMenu.getAttribute('aria-hidden') === 'true';
					contextMenu.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
					contextMenu.classList.toggle('open');
				});

				document.addEventListener('click', function() {
					contextMenu.setAttribute('aria-hidden', 'true');
					contextMenu.classList.remove('open');
				});

				contextMenu.addEventListener('click', function(e) {
					e.stopPropagation();
				});
			}

			const mobileHomework = document.getElementById('mobile-homework-btn');
			if (mobileHomework) {
				mobileHomework.addEventListener('click', function() {
					if (contextMenu) {
						contextMenu.setAttribute('aria-hidden', 'true');
						contextMenu.classList.remove('open');
					}
					if (self.config.onHomework && typeof self.config.onHomework === 'function') {
						self.config.onHomework(self.examData);
					}
				});
			}

			const mobileDownload = document.getElementById('mobile-download-btn');
			if (mobileDownload) {
				mobileDownload.addEventListener('click', function() {
					if (contextMenu) {
						contextMenu.setAttribute('aria-hidden', 'true');
						contextMenu.classList.remove('open');
					}
					self._exportToPDF();
				});
			}
		},

		_exportToPDF: function() {
			const self = this;
			
			const overlay = document.getElementById('export-overlay');
			const progressBar = overlay ? overlay.querySelector('.export-progress-bar') : null;
			
			if (overlay) {
				overlay.setAttribute('aria-hidden', 'false');
				overlay.classList.add('visible');
			}
			
			if (progressBar) progressBar.style.width = '0%';

			setTimeout(function() {
				const pages = Array.from(document.querySelectorAll('.page'));
				if (!pages.length) {
					if (overlay) {
						overlay.setAttribute('aria-hidden', 'true');
						overlay.classList.remove('visible');
					}
					alert('Sayfa bulunamadı');
					return;
				}

				const { jsPDF } = window.jspdf;
				const pdf = new jsPDF('p', 'mm', 'a4');
				const pdfWidth = pdf.internal.pageSize.getWidth();
				const pdfHeight = pdf.internal.pageSize.getHeight();

				let processedCount = 0;

				function processPage(index) {
					if (index >= pages.length) {
						pdf.save(self.config.export.filename);
						if (overlay) {
							overlay.setAttribute('aria-hidden', 'true');
							overlay.classList.remove('visible');
						}
						self._showSuccessOverlay();
						return;
					}

					const page = pages[index];
					
					html2canvas(page, {
						scale: 2,
						useCORS: true,
						allowTaint: true,
						backgroundColor: '#ffffff',
						logging: false
					}).then(function(canvas) {
						const imgData = canvas.toDataURL('image/jpeg', 0.95);
						
						if (index > 0) {
							pdf.addPage();
						}
						
						pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
						
						processedCount++;
						const progress = (processedCount / pages.length) * 100;
						if (progressBar) progressBar.style.width = progress + '%';

						setTimeout(function() {
							processPage(index + 1);
						}, 100);
					}).catch(function(error) {
						console.error('Canvas error:', error);
						processPage(index + 1);
					});
				}

				processPage(0);
			}, 100);
		},

		_applyLocaleTransforms: function(root) {
			const self = this;
			const elements = root.querySelectorAll('.text-uppercase-tr');
			elements.forEach(function(el) {
				const text = el.textContent;
				el.textContent = self._toUpperCaseTR(text);
			});
		},

		_toUpperCaseTR: function(str) {
			const map = { 'i': 'İ', 'ş': 'Ş', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö', 'ç': 'Ç', 'ı': 'I' };
			return str.replace(/[işğüöçı]/g, function(c) { return map[c] || c; }).toUpperCase();
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
		}
	};

	window.DenemePDF = DenemePDF;

})(window, document);
