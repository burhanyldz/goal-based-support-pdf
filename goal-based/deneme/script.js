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
		onDataSaved: null,
		onError: null
	};
	
	// Main plugin object
	const DenemePDF = {
		config: {},
		examData: null,
		container: null,
		initialized: false,
		currentTestType: null,
		_isRendering: false,
		_pendingDownload: false,
		
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
			
			// Create and initialize modal
			this._createModal();
			this._initModal();
			
			if (this.config.export.enabled) {
				this._createExportOverlay();
				this._createSuccessOverlay();
			}				this._setupEventListeners();
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

		openEdit: function() {
			if (!this.initialized) return;
			const modal = document.getElementById('edit-modal');
			if (modal) {
				// Trigger the modal open function
				const editBtn = document.getElementById('edit-meta-btn');
				if (editBtn) {
					editBtn.click();
				}
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
			
			// Mark rendering as in progress
			this._isRendering = true;
			
			// Use testType from examData if provided; otherwise default to tyt
			const testType = examData.testType || 'tyt';
			
			// Check if testType is valid (exists in availableTestTypes)
			const availableTypes = examData.availableTestTypes || [];
			const isValidTestType = availableTypes.includes(testType);
			
			this.currentTestType = testType;
			this._initializeTheme(testType);
			
			rootElement.innerHTML = '';
			
			// Create cover pages only if testType is valid
			let pageCount = 0;
			if (isValidTestType) {
				const coverPage1 = this._createCoverPage(testType, 1);
				const coverPage2 = this._createCoverPage(testType, 2);
				rootElement.appendChild(coverPage1);
				rootElement.appendChild(coverPage2);
				pageCount = 2;
			}
			
			const pagesState = {
				examData,
				pages: [/* coverPage1, coverPage2 */],
				pageCount: pageCount,
				currentPage: null,
				currentColumn: 'left',
				currentTest: null,
				globalPageNumber: pageCount + 1 // Start page numbering after cover pages (or 1 if no covers)
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
				
				// Mark rendering as complete
				self._isRendering = false;
				
				// If a download was requested during rendering, execute it now
				if (self._pendingDownload) {
					self._pendingDownload = false;
					self._exportToPDF();
				}

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
			if (pageNumber === 1) {
				page.innerHTML = `
					<img src="images/${imageFilename}" alt="${testType.toUpperCase()} Kapak ${pageNumber}" class="cover-image">
					<div id="school-name" class="school-name"></div>
				`;
				if (this.examData && this.examData.attentionCandidate) {
					page.innerHTML += `
						<div class="attention-candidate">
							ADAYIN DİKKATİNE!<br>
							${this.examData.attentionCandidate || ''}
						</div>
					`;
				}
			} else {
				if (this.examData && this.examData.attention) {
					page.innerHTML = `
					<div class="attention-box">
						<div class="attention-label">DİKKAT!</div>
						<div class="attention">
							${this.examData.attention || ''}
						</div>
					</div>
					`;
				}
				if (this.examData && this.examData.denemeInstructions) {
					page.innerHTML += `
					<div class="deneme-instructions">
						<b>AÇIKLAMA</b><br>
						${this.examData.denemeInstructions || ''}
					</div>
					`;
				}
			}
			// Fill school name if first cover page
			if (pageNumber === 1 && this.examData && this.examData.schoolName) {
				const schoolDiv = page.querySelector('#school-name');
				if (schoolDiv) schoolDiv.textContent = this.examData.schoolName;
			}
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
			
			const testTypeUpper = this.currentTestType ? this.currentTestType.toUpperCase() : '';
			const testName = test.name || '';
			
			page.innerHTML = `
				<div class="header">
					<div class="header-left">YKS DENEMELERİ</div>
					<div class="header-center">Ortaöğretim Genel Müdürlüğü</div>
					<div class="header-right">${this._escapeHtml(this.examData.denemeName || '')}</div>
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

		// Desktop Edit button
		const editBtn = this._createEl('button', 'btn btn-primary desktop-btn');
		editBtn.id = 'edit-meta-btn';
		editBtn.type = 'button';
		editBtn.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<span>Düzenle</span>`;
		actions.appendChild(editBtn);			if (this.config.toolbar.showHomework) {
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

			// Mobile icon-only buttons (match single-test; no Edit in deneme)
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

			const menuBtn = this._createEl('button', 'btn btn-icon mobile-btn');
			menuBtn.id = 'mobile-menu-btn';
			menuBtn.type = 'button';
			menuBtn.title = 'Menü';
			menuBtn.innerHTML = `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
					<circle cx="12" cy="12" r="1" fill="currentColor"/>
					<circle cx="12" cy="5" r="1" fill="currentColor"/>
					<circle cx="12" cy="19" r="1" fill="currentColor"/>
				</svg>
				<span class="sr-only">Menü</span>`;
			actions.appendChild(menuBtn);

			const contextMenu = this._createEl('div', 'mobile-context-menu');
			contextMenu.id = 'mobile-context-menu';
			contextMenu.setAttribute('aria-hidden', 'true');

			// Mobile Edit button
			const mobileEditBtn = this._createEl('button', 'context-menu-item');
			mobileEditBtn.id = 'mobile-edit-btn';
			mobileEditBtn.type = 'button';
			mobileEditBtn.innerHTML = `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Düzenle</span>`;
			contextMenu.appendChild(mobileEditBtn);

			if (this.config.toolbar.showHomework) {
				const mobileHomeworkBtn = this._createEl('button', 'context-menu-item');
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
				const mobileDownloadBtn = this._createEl('button', 'context-menu-item');
				mobileDownloadBtn.id = 'mobile-download-btn';
				mobileDownloadBtn.type = 'button';
				mobileDownloadBtn.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
						<path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M21 21H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
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

		_createModal: function() {
			if (document.getElementById('edit-modal')) return;

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
			h3.textContent = 'Deneme Bilgilerini Düzenle';
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
				<div class="form-group">
					<label for="input-denemeName">Deneme Başlığı</label>
					<input id="input-denemeName" type="text" placeholder="Deneme başlığı" maxlength="100">
				</div>
				<div class="form-group">
					<label for="wysiwyg-attentionCandidate">Adayın Dikkatine metni</label>
					<div class="wysiwyg-toolbar" data-target="attentionCandidate">
						<button type="button" data-command="bold" title="Kalın"><b>B</b></button>
						<button type="button" data-command="italic" title="İtalik"><i>I</i></button>
						<button type="button" data-command="underline" title="Altı çizili"><u>U</u></button>
						<button type="button" data-command="strikeThrough" title="Üstü çizili"><s>S</s></button>
						<span class="toolbar-separator"></span>
						<button type="button" data-command="insertOrderedList" title="Numaralı liste">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>
								<text x="3" y="8" font-size="8" fill="currentColor">1.</text>
								<text x="3" y="14" font-size="8" fill="currentColor">2.</text>
								<text x="3" y="20" font-size="8" fill="currentColor">3.</text>
							</svg>
						</button>
						<button type="button" data-command="insertUnorderedList" title="Madde işaretli liste">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>
								<circle cx="4" cy="6" r="2" fill="currentColor"/>
								<circle cx="4" cy="12" r="2" fill="currentColor"/>
								<circle cx="4" cy="18" r="2" fill="currentColor"/>
							</svg>
						</button>
						<span class="toolbar-separator"></span>
						<button type="button" data-command="undo" title="Geri al">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
						<button type="button" data-command="redo" title="Yinele">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M15 14l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
					</div>
					<div id="wysiwyg-attentionCandidate" class="wysiwyg-editor" contenteditable="true" data-placeholder="Adayın dikkatine metni..."></div>
				</div>
				<div class="form-group">
					<label for="wysiwyg-attention">Dikkat metni</label>
					<div class="wysiwyg-toolbar" data-target="attention">
						<button type="button" data-command="bold" title="Kalın"><b>B</b></button>
						<button type="button" data-command="italic" title="İtalik"><i>I</i></button>
						<button type="button" data-command="underline" title="Altı çizili"><u>U</u></button>
						<button type="button" data-command="strikeThrough" title="Üstü çizili"><s>S</s></button>
						<span class="toolbar-separator"></span>
						<button type="button" data-command="insertOrderedList" title="Numaralı liste">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>
								<text x="3" y="8" font-size="8" fill="currentColor">1.</text>
								<text x="3" y="14" font-size="8" fill="currentColor">2.</text>
								<text x="3" y="20" font-size="8" fill="currentColor">3.</text>
							</svg>
						</button>
						<button type="button" data-command="insertUnorderedList" title="Madde işaretli liste">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>
								<circle cx="4" cy="6" r="2" fill="currentColor"/>
								<circle cx="4" cy="12" r="2" fill="currentColor"/>
								<circle cx="4" cy="18" r="2" fill="currentColor"/>
							</svg>
						</button>
						<span class="toolbar-separator"></span>
						<button type="button" data-command="undo" title="Geri al">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
						<button type="button" data-command="redo" title="Yinele">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M15 14l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
					</div>
					<div id="wysiwyg-attention" class="wysiwyg-editor" contenteditable="true" data-placeholder="Dikkat metni..."></div>
				</div>
				<div class="form-group">
					<label for="wysiwyg-denemeInstructions">Açıklama Metni</label>
					<div class="wysiwyg-toolbar" data-target="denemeInstructions">
						<button type="button" data-command="bold" title="Kalın"><b>B</b></button>
						<button type="button" data-command="italic" title="İtalik"><i>I</i></button>
						<button type="button" data-command="underline" title="Altı çizili"><u>U</u></button>
						<button type="button" data-command="strikeThrough" title="Üstü çizili"><s>S</s></button>
						<span class="toolbar-separator"></span>
						<button type="button" data-command="insertOrderedList" title="Numaralı liste">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>
								<text x="3" y="8" font-size="8" fill="currentColor">1.</text>
								<text x="3" y="14" font-size="8" fill="currentColor">2.</text>
								<text x="3" y="20" font-size="8" fill="currentColor">3.</text>
							</svg>
						</button>
						<button type="button" data-command="insertUnorderedList" title="Madde işaretli liste">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
								<line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>
								<circle cx="4" cy="6" r="2" fill="currentColor"/>
								<circle cx="4" cy="12" r="2" fill="currentColor"/>
								<circle cx="4" cy="18" r="2" fill="currentColor"/>
							</svg>
						</button>
						<span class="toolbar-separator"></span>
						<button type="button" data-command="undo" title="Geri al">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
						<button type="button" data-command="redo" title="Yinele">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M15 14l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</button>
					</div>
					<div id="wysiwyg-denemeInstructions" class="wysiwyg-editor" contenteditable="true" data-placeholder="Açıklama metni..."></div>
				</div>
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

			if (this.container && this.container.parentNode) {
				this.container.parentNode.insertBefore(modalOverlay, this.container);
			} else {
				document.body.appendChild(modalOverlay);
			}
		},

		_initModal: function() {
			const self = this;
			const modal = document.getElementById('edit-modal');
			if (!modal) return;

			const editBtn = document.getElementById('edit-meta-btn');
			const mobileEditBtn = document.getElementById('mobile-edit-btn');
			const closeBtn = document.getElementById('edit-modal-close');
			const cancelBtn = document.getElementById('modal-cancel');
			const saveBtn = document.getElementById('modal-save');

			// Setup WYSIWYG toolbars
			try {
				document.execCommand('styleWithCSS', false, false);
			} catch (error) {
				// Ignore unsupported command errors
			}
			const toolbars = modal.querySelectorAll('.wysiwyg-toolbar');
			toolbars.forEach(function(toolbar) {
				const buttons = toolbar.querySelectorAll('button[data-command]');
				const targetId = toolbar.getAttribute('data-target');
				const editor = document.getElementById('wysiwyg-' + targetId);
				const inlineCommands = ['bold', 'italic', 'underline', 'strikeThrough'];
				
				buttons.forEach(function(btn) {
					btn.addEventListener('mousedown', function(e) {
						e.preventDefault(); // Keep focus inside the editor
					});
					
					btn.addEventListener('click', function(e) {
						e.preventDefault();
						if (!editor) return;

						const command = this.getAttribute('data-command');
						const selection = window.getSelection();
						const hasSelection = selection && selection.toString().length > 0;
						
						// Only allow inline formatting when user selected text
						if (inlineCommands.includes(command) && !hasSelection) {
							return;
						}

						editor.focus();
						document.execCommand(command, false, null);

						// Collapse selection to end and toggle command off so new typing stays normal
						if (inlineCommands.includes(command) && selection && selection.rangeCount > 0) {
							const preservedRange = selection.getRangeAt(0).cloneRange();
							selection.collapseToEnd();
							try {
								document.execCommand(command, false, null);
							} catch (toggleError) {
								// Ignore browsers that refuse the command
							}
							selection.removeAllRanges();
							selection.addRange(preservedRange);
						}

						editor.focus();
					});
				});

				if (editor && !editor.__wysiwygInitialized) {
					editor.__wysiwygInitialized = true;

					const formatAncestors = {
						bold: ['b', 'strong'],
						italic: ['i', 'em'],
						underline: ['u'],
						strikeThrough: ['s', 'strike']
					};

					const hasFormattingAncestor = function(node, tags) {
						while (node && node !== editor) {
							if (node.nodeType === Node.ELEMENT_NODE && tags.includes(node.nodeName.toLowerCase())) {
								return true;
							}
							node = node.parentNode;
						}
						return false;
					};

					const resetTypingState = function() {
						const sel = window.getSelection();
						if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;

						const anchorNode = sel.anchorNode;
						if (!anchorNode || !editor.contains(anchorNode)) return;

						Object.keys(formatAncestors).forEach(function(cmd) {
							let commandActive = false;
							try {
								commandActive = document.queryCommandState(cmd);
							} catch (stateError) {
								commandActive = false;
							}

							if (!commandActive) return;
							if (hasFormattingAncestor(anchorNode, formatAncestors[cmd])) return;

							const rangeSnapshot = sel.getRangeAt(0).cloneRange();
							editor.focus();
							try {
								document.execCommand(cmd, false, null);
							} catch (toggleError) {
								// Ignore browsers that refuse the command
							}
							sel.removeAllRanges();
							sel.addRange(rangeSnapshot);
						});
					};

					const scheduleReset = function() {
						clearTimeout(editor.__resetTimer);
						editor.__resetTimer = setTimeout(resetTypingState, 0);
					};

					document.addEventListener('selectionchange', scheduleReset);
					editor.addEventListener('mouseenter', scheduleReset);
					editor.addEventListener('focus', scheduleReset);
					editor.addEventListener('mouseup', scheduleReset);
					editor.addEventListener('keyup', scheduleReset);
					editor.addEventListener('keydown', function(e) {
						if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
							resetTypingState();
						}
					});
				}
			});

			function openModal() {
				const data = self.examData || {};
				
				const inputDenemeName = document.getElementById('input-denemeName');
				const wysiwygAttentionCandidate = document.getElementById('wysiwyg-attentionCandidate');
				const wysiwygAttention = document.getElementById('wysiwyg-attention');
				const wysiwygDenemeInstructions = document.getElementById('wysiwyg-denemeInstructions');

				if (inputDenemeName) inputDenemeName.value = data.denemeName || '';
				
				// Set HTML content directly (already formatted)
				if (wysiwygAttentionCandidate) {
					wysiwygAttentionCandidate.innerHTML = data.attentionCandidate || '';
				}
				if (wysiwygAttention) {
					wysiwygAttention.innerHTML = data.attention || '';
				}
				if (wysiwygDenemeInstructions) {
					wysiwygDenemeInstructions.innerHTML = data.denemeInstructions || '';
				}

				modal.setAttribute('aria-hidden', 'false');
				modal.classList.add('open');
				document.body.classList.add('modal-open');
				
				if (inputDenemeName) inputDenemeName.focus();
			}

			function closeModal() {
				modal.setAttribute('aria-hidden', 'true');
				modal.classList.remove('open');
				document.body.classList.remove('modal-open');
			}

		function saveModal() {
			const inputDenemeName = document.getElementById('input-denemeName');
			const wysiwygAttentionCandidate = document.getElementById('wysiwyg-attentionCandidate');
			const wysiwygAttention = document.getElementById('wysiwyg-attention');
			const wysiwygDenemeInstructions = document.getElementById('wysiwyg-denemeInstructions');

			const oldData = JSON.parse(JSON.stringify(self.examData || {}));
			
			if (inputDenemeName) self.examData.denemeName = inputDenemeName.value.trim();
			
			// Save HTML content with formatting preserved
			if (wysiwygAttentionCandidate) {
				self.examData.attentionCandidate = wysiwygAttentionCandidate.innerHTML;
			}
			if (wysiwygAttention) {
				self.examData.attention = wysiwygAttention.innerHTML;
			}
			if (wysiwygDenemeInstructions) {
				self.examData.denemeInstructions = wysiwygDenemeInstructions.innerHTML;
			}
			
			// Callback
			if (self.config.onDataSaved && typeof self.config.onDataSaved === 'function') {
				self.config.onDataSaved(self.examData, oldData);
			}

			// Re-render
			self.render(self.examData);
			closeModal();
		}

			if (editBtn) editBtn.addEventListener('click', openModal);
			if (mobileEditBtn) mobileEditBtn.addEventListener('click', function() {
				const contextMenu = document.getElementById('mobile-context-menu');
				if (contextMenu) {
					contextMenu.setAttribute('aria-hidden', 'true');
					contextMenu.classList.remove('show');
				}
				openModal();
			});
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
					contextMenu.classList.toggle('show');
				});

				document.addEventListener('click', function() {
					contextMenu.setAttribute('aria-hidden', 'true');
					contextMenu.classList.remove('show');
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
						contextMenu.classList.remove('show');
					}
					if (self.config.onHomework && typeof self.config.onHomework === 'function') {
						self.config.onHomework(self.examData);
					}
				});
			}

			// Mobile icon-only homework button
			const mobileHomeworkIconBtn = document.getElementById('mobile-homework-icon-btn');
			if (mobileHomeworkIconBtn) {
				mobileHomeworkIconBtn.addEventListener('click', function() {
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
						contextMenu.classList.remove('show');
					}
					self._exportToPDF();
				});
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

		_exportToPDF: function() {
			const self = this;
			
			// Set download button to loading state and replace icon with spinner
			const downloadBtn = document.getElementById('download-pdf-btn');
			const mobileDownloadBtn = document.getElementById('mobile-download-btn');
			
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
			if (mobileDownloadBtn) {
				mobileDownloadBtn.disabled = true;
				mobileDownloadBtn.classList.add('loading');
				// Store original icon
				if (!mobileDownloadBtn.dataset.originalIcon) {
					mobileDownloadBtn.dataset.originalIcon = mobileDownloadBtn.querySelector('svg').outerHTML;
				}
				// Replace with spinner
				const svgContainer = mobileDownloadBtn.querySelector('svg');
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

			// Optimal settings
			const USE_PNG = true;

			setTimeout(function() {
				const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, precision: 16 });
				const pdfWidth = pdf.internal.pageSize.getWidth();
				const pdfHeight = pdf.internal.pageSize.getHeight();

				let processedCount = 0;

				function processPage(index) {
					if (index >= pages.length) {
						pdf.save(self.config.export.filename);
						hideOverlay();
						self._showSuccessOverlay();
						
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
						if (mobileDownloadBtn) {
							mobileDownloadBtn.disabled = false;
							mobileDownloadBtn.classList.remove('loading');
							if (mobileDownloadBtn.dataset.originalIcon) {
								const svgContainer = mobileDownloadBtn.querySelector('svg');
								if (svgContainer) {
									svgContainer.outerHTML = mobileDownloadBtn.dataset.originalIcon;
								}
							}
						}
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
						const imgData = canvas.toDataURL(USE_PNG ? 'image/png' : 'image/jpeg', 1.0);
						if (index > 0) pdf.addPage();
						pdf.addImage(imgData, USE_PNG ? 'PNG' : 'JPEG', 0, 0, pdfWidth, pdfHeight);

						processedCount++;
						updateOverlayProgress(processedCount, pages.length);

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
