// PDFPreview - vanilla JS plugin for rendering the PDF-like pages from JSON data
// Usage: PDFPreview.render(data)  -- if data is omitted it will load example.json

(function () {
	const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// QR initializer: prefer local QRious (qrious.min.js) if loaded, otherwise fallback to external image
function initQRCodeOnPage(page, data) {
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
		// fail silently
		console.error('initQRCodeOnPage error', e);
	}
}

function qs(sel, root = document) { return root.querySelector(sel); }

	function createEl(tag, cls, attrs = {}) {
		const el = document.createElement(tag);
		if (cls) el.className = cls;
		Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
		return el;
	}

	function createFirstPage(data) {
		const page = createEl('div', 'page odd first-page');
		page.innerHTML = `
			<div class="header">
				<img src="images/mebi.png" alt="MEBİ Logo" class="mebi_logo">
				<img src="images/stripes.png" class="stripes">
				<img src="images/ribbon.png" class="ribbon">
				<div class="test-type">${escapeHtml(data.testType || '')}</div>
				<span class="page-title">HEDEF TEMELLİ DESTEK EĞİTİMİ</span>
				<span class="first-page-subtitle">${escapeHtml(data.schoolName || 'okul adı')}</span>
				<div class="first-page-bar">
					<span class="lesson-name">${escapeHtml(data.lessonName || 'ders adı')}</span>
					<span class="subject-name">${escapeHtml(data.subjectName || 'konu adı')}</span>
					<div class="qr-code"><img src="${escapeHtml(data.qrCodeUrl || '')}"></div>
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
				<img src="images/ribbon2.png" class="ogm-ribbon">
				<div class="page-number"></div>
				<img src="images/ribbon.png" class="ribbon">
				<img src="images/stripes.png" class="stripes">
				<div class="footer-disclaimer">
					Bu sayfada bulunan içeriklerin tüm yayın hakları Millî Eğitim Bakanlığı'na aittir. Hiçbir şekilde ticari amaçla kullanılamaz veya kullandırılamaz. Bu sayfada yer alan içeriğin ticari amaçla kullanılması, 5846 sayılı Fikir ve Sanat Eserleri Yasası'nın 36. maddesine aykırıdır ve açıkça suçtur. Aykırı davrananlar hakkında, hukuki ve cezai her türlü başvuru hakkı saklıdır.
				</div>

			</div>
		`;
		// set school name in title area
	const subtitle = qs('.first-page-subtitle', page);
	if (subtitle) subtitle.textContent = data.schoolName || 'okul adı';

		// QR will be initialized after the page is appended (initQRCodeOnPage)
		return page;
	}

	function createNormalPage(isOdd, data) {
		const cls = 'page ' + (isOdd ? 'odd' : 'even');
		const page = createEl('div', cls);
		page.innerHTML = `
			<div class="header">
				<span class="page-title">HEDEF TEMELLİ DESTEK EĞİTİMİ</span>
				<img src="images/mebi.png" alt="MEBİ Logo" class="mebi_logo">
				<img src="images/stripes.png" class="stripes">
				<div class="page-bar">
					<span class="subject-name">${escapeHtml(data.subjectName || 'konu adı')}</span>
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
				<img src="images/ribbon2.png" class="ogm-ribbon">
				<div class="page-number"></div>
				<img src="images/ribbon.png" class="ribbon">
				<img src="images/stripes.png" class="stripes">
				<div class="footer-disclaimer">
					Bu sayfada bulunan içeriklerin tüm yayın hakları Millî Eğitim Bakanlığı'na aittir. Hiçbir şekilde ticari amaçla kullanılamaz veya kullandırılamaz. Bu sayfada yer alan içeriğin ticari amaçla kullanılması, 5846 sayılı Fikir ve Sanat Eserleri Yasası'nın 36. maddesine aykırıdır ve açıkça suçtur. Aykırı davrananlar hakkında, hukuki ve cezai her türlü başvuru hakkı saklıdır.
				</div>
			</div>
		`;
		return page;
	}

	function createQuestionElement(q) {
		// create structure but don't set src yet — we'll crop the image first
		const wrapper = createEl('div', 'question');
		const num = createEl('div', 'question-number');
		num.textContent = q.questionNumber != null ? q.questionNumber + '.' : '';
		const img = createEl('img', 'question-image');
		// ensure aspect ratio preserved
		img.style.width = '100%';
		img.style.height = 'auto';
		wrapper.appendChild(num);
		wrapper.appendChild(img);
		return { wrapper, img, originalSrc: q.imageUrl || '' };
	}

	// Crop whitespace around an image by drawing it to a canvas and trimming background
	// Returns a dataURL string for the cropped image. If cropping fails (CORS or error), resolves to the original src.
	function cropImageWhitespace(src, options = {}) {
		const padding = typeof options.padding === 'number' ? options.padding : 1; // pixels to keep around content (changed to 1px)
		const bgThreshold = typeof options.bgThreshold === 'number' ? options.bgThreshold : 180; // more aggressive threshold (was 200)
		const alphaThreshold = typeof options.alphaThreshold === 'number' ? options.alphaThreshold : 16; // alpha > this considered non-empty
		const minCropMargin = typeof options.minCropMargin === 'number' ? options.minCropMargin : 1; // only crop if we can remove at least this many pixels

		return new Promise((resolve) => {
			if (!src) return resolve(src);
			const img = new Image();
			img.crossOrigin = 'Anonymous';
			let cleaned = false;
			// timer reference will be set later; clear it when we finish to avoid stray timeouts
			let timer = null;

			const finish = (resultSrc) => {
				if (!cleaned) {
					cleaned = true;
					try { if (timer) clearTimeout(timer); } catch (e) {}
					resolve(resultSrc);
				}
			};

			img.onload = () => {
				try {
					const w = img.naturalWidth || img.width;
					const h = img.naturalHeight || img.height;
					if (!w || !h) return finish(src);
					
					const canvas = document.createElement('canvas');
					canvas.width = w;
					canvas.height = h;
					const ctx = canvas.getContext('2d');
					// ensure we draw at native resolution and avoid any smoothing that might alter pixels
					if (ctx) {
						ctx.imageSmoothingEnabled = false;
						try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
					}
					ctx.drawImage(img, 0, 0, w, h);
					let data;
					try { data = ctx.getImageData(0, 0, w, h).data; } catch (e) { return finish(src); }

					// Helper function to check if a pixel is "white" (background)
					const isWhitePixel = (r, g, b, a) => {
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
					
					const leftTrimmed = minX;
					const rightTrimmed = (w - 1) - maxX;
					const topTrimmed = minY;
					const bottomTrimmed = (h - 1) - maxY;
										
					const out = document.createElement('canvas');
					out.width = cw;
					out.height = ch;
					const outCtx = out.getContext('2d');
					if (outCtx) {
						outCtx.imageSmoothingEnabled = false;
						try { outCtx.imageSmoothingQuality = 'high'; } catch (e) {}
					}
					outCtx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

					// Export as lossless PNG blob and return an object URL. This preserves exact pixel data
					// (browser still drops EXIF/ICC profiles, which is unavoidable with canvas APIs).
					try {
						out.toBlob((blob) => {
							if (!blob) return finish(src);
							const url = URL.createObjectURL(blob);
							console.debug('cropImageWhitespace: created blob URL for cropped image, size:', blob.size, 'bytes');
							return finish(url);
						}, 'image/png');
						// toBlob is async and will call finish from the callback
						return;
					} catch (e) {
						// fallback to dataURL if toBlob not available
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

			img.onerror = () => {
				// likely CORS or network error — can't read pixels, fallback to original src
				finish(src);
			};

			// safety timeout: if loading hangs, bail
			timer = setTimeout(() => finish(src), 3000);
			img.decoding = 'async';
			img.src = src;
		});
	}

	function escapeHtml(s) {
		if (!s) return '';
		return String(s).replace(/[&<>"']/g, function (c) {
			return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c];
		});
	}

	// Apply locale-aware transforms for elements that rely on CSS text-transform
	// Stores the original innerHTML on first run in data-original-html to avoid double transforms
	function applyLocaleTransforms(root) {
		try {
			const elements = Array.from((root && root.querySelectorAll) ? root.querySelectorAll('*') : []);
			// include root itself
			if (root && root.nodeType === 1) elements.unshift(root);

			elements.forEach(el => {
				const cs = window.getComputedStyle(el);
				const t = (cs && cs.textTransform) ? cs.textTransform : 'none';
				if (!t || t === 'none') return;

				// preserve original HTML the first time so we can always re-derive from source
				if (!el.hasAttribute('data-original-html')) {
					el.setAttribute('data-original-html', el.innerHTML);
				}
				const originalHtml = el.getAttribute('data-original-html') || el.innerHTML;

				// Use a temporary container so we can operate on text nodes while keeping markup
				const tmp = document.createElement('div');
				tmp.innerHTML = originalHtml;

				const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null, false);
				const textNodes = [];
				while (walker.nextNode()) textNodes.push(walker.currentNode);

				textNodes.forEach(node => {
					const val = node.nodeValue || '';
					if (!val.trim()) return; // skip whitespace-only nodes
					let out = val;
					if (t === 'uppercase') {
						out = val.toLocaleUpperCase('tr');
					} else if (t === 'lowercase') {
						out = val.toLocaleLowerCase('tr');
					} else if (t === 'capitalize') {
						// capitalize each word using Turkish locale
						out = val.split(/(\s+)/).map(part => {
							// preserve whitespace
							if (/^\s+$/.test(part)) return part;
							const first = part.charAt(0).toLocaleUpperCase('tr');
							const rest = part.slice(1).toLocaleLowerCase('tr');
							return first + rest;
						}).join('');
					}
					if (out !== val) node.nodeValue = out;
				});

				// replace element content with transformed HTML
				el.innerHTML = tmp.innerHTML;
			});
		} catch (e) {
			// don't break rendering on locale transform errors
			console.warn('applyLocaleTransforms error', e);
		}
	}

	// check whether element overflows its container vertically
	function isOverflowing(container) {
		return container.scrollHeight > container.clientHeight + 1; // small tolerance
	}

	// place a single question into columns/pages; returns a promise that resolves once placed
	async function placeQuestion(root, pagesState, q) {
		// pagesState: { currentPage, currentColumnName ('left'|'right'), pageIndex }
		const tryPlace = (pageEl, columnName) => {
			const column = qs('.' + columnName + '-column', pageEl) || qs('.' + columnName + '-column', pageEl) || qs('.' + columnName + '-column', pageEl);
			// our actual markup uses .left-column and .right-column
			const col = qs('.' + columnName + '-column', pageEl) || qs('.' + columnName + ' .'+columnName, pageEl);
		};

		// simpler accessors
		const placeInColumn = (pageEl, colSelector, questionEl) => {
			const col = qs(colSelector, pageEl);
			col.appendChild(questionEl.wrapper);
		};

		const ensureImageLoaded = (img) => new Promise((res) => {
			if (img.complete && img.naturalHeight !== 0) return res();
			img.addEventListener('load', () => res(), { once: true });
			img.addEventListener('error', () => res(), { once: true });
			// safety timeout
			setTimeout(res, 1500);
		});

		let placed = false;
		let attemptColumn = pagesState.currentColumn; // 'left' or 'right'

		while (!placed) {
			const pageEl = pagesState.currentPage;
			const colSelector = attemptColumn === 'left' ? '.left-column' : '.right-column';
			// create element, crop the source and set src before appending so size is known
			const questionEl = createQuestionElement(q);
			// attempt to crop whitespace; if cropping fails we'll get original src back
			let croppedSrc;
			try {
				croppedSrc = await cropImageWhitespace(questionEl.originalSrc);
			} catch (e) {
				croppedSrc = questionEl.originalSrc;
			}
			// set src then append
			const finalSrc = croppedSrc || questionEl.originalSrc;
			questionEl.img.src = finalSrc;
			
			// debugging markers: indicate whether cropping produced a data URL or fallback
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

			// wait for image to load so measurements are correct
			await ensureImageLoaded(questionEl.img);
			// log rendered sizes for debugging

			const colNode = qs(colSelector, pageEl);
			if (!isOverflowing(colNode)) {
				// fits in this column
				placed = true;
				// after placing in left, next should still try left until overflow
				pagesState.currentColumn = attemptColumn;
				return;
			}

			// doesn't fit; remove and try next column
			questionEl.wrapper.remove();
			if (attemptColumn === 'left') {
				// try right column of same page
				attemptColumn = 'right';
				// if right column is same as left and was already tried, will fall through
				const rightQuestion = createQuestionElement(q);
				let croppedRight;
				try { croppedRight = await cropImageWhitespace(rightQuestion.originalSrc); } catch (e) { croppedRight = rightQuestion.originalSrc; }
				rightQuestion.img.src = croppedRight || rightQuestion.originalSrc;
				try {
					if (rightQuestion.wrapper && typeof rightQuestion.wrapper.setAttribute === 'function') {
						if (croppedRight && (String(croppedRight).startsWith('data:') || String(croppedRight).startsWith('blob:'))) {
							rightQuestion.wrapper.setAttribute('data-cropped', 'yes');
							rightQuestion.wrapper.setAttribute('data-cropped-src', croppedRight.startsWith('blob:') ? 'blob' : 'data');
						} else {
							rightQuestion.wrapper.setAttribute('data-cropped', 'no');
							rightQuestion.wrapper.setAttribute('data-cropped-src', 'remote');
						}
					}
				} catch (e) { /* silent */ }
				placeInColumn(pageEl, '.right-column', rightQuestion);
				await ensureImageLoaded(rightQuestion.img);
				// log rendered sizes for debugging (right column)
				
				const rightColNode = qs('.right-column', pageEl);
				if (!isOverflowing(rightColNode)) {
					pagesState.currentColumn = 'right';
					placed = true;
					return;
				}
				rightQuestion.wrapper.remove();
				// both columns full -> create new page and continue loop
			}

			// create a new page and append to root
			const newIsOdd = ((pagesState.pageCount + 1) % 2) === 1; // alternation
			const newPage = createNormalPage(newIsOdd, pagesState.data);
			root.appendChild(newPage);
			pagesState.pages.push(newPage);
			pagesState.pageCount += 1;
			pagesState.currentPage = newPage;
			pagesState.currentColumn = 'left';
			attemptColumn = 'left';
			// loop will try placing on new page
		}
	}

	function setPageNumbers(root) {
		const pages = Array.from(root.querySelectorAll('.page'));
		pages.forEach((p, idx) => {
			const pn = qs('.page-number', p);
			if (pn) pn.textContent = String(idx + 1);
		});
	}

	function buildAnswerKey(data) {
		const page = createEl('div', 'page answer-key');
		page.innerHTML = `
			<div class="content">
				<div class="answer-key-title">CEVAP ANAHTARI</div>
				<div class="answers"></div>
			</div>
		`;
		const answersContainer = qs('.answers', page);
		const answers = Array.isArray(data.answers) ? data.answers.slice() : [];
		const questions = Array.isArray(data.questions) ? data.questions.slice() : [];
		const groups = Math.ceil(answers.length / 10) || 1;
		const total = groups * 10;
		// create total slots
		for (let i = 0; i < total; i++) {
			const slot = createEl('div', 'answer-question');
			const spanNum = createEl('span');
			// Only display the question number if a corresponding question exists
			const questionExists = questions.some(q => q.questionNumber === (i + 1));
			spanNum.textContent = questionExists ? (i + 1) + '.' : '';
			const spanChoice = createEl('span');
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
	}

  async function render(data, rootElement) {
    if (!data) {
      console.error('PDFPreview.render: data parameter is required');
      return;
    }

    const root = rootElement || document.getElementById('pdf-root');
    if (!root) {
      console.error('PDFPreview.render: no root element provided or #pdf-root element found in DOM');
      return;
    }
    root.innerHTML = '';		// create first page and append
		const firstPage = createFirstPage(data);
		root.appendChild(firstPage);
		// initialize QR code area (prefers local QRious if available)
		try { initQRCodeOnPage(firstPage, data); } catch (e) { /* silent */ }

		const pagesState = {
			data,
			pages: [firstPage],
			pageCount: 1,
			currentPage: firstPage,
			currentColumn: 'left'
		};

		// iterate questions sequentially so measurements are predictable
		const qsArr = Array.isArray(data.questions) ? data.questions : [];
		for (const q of qsArr) {
			// Place question, awaiting placement
			// Adjust: the placeQuestion function will create and place
			await placeQuestion(root, pagesState, q);
		}

		// after questions placed, append answer key page
		const answerPage = buildAnswerKey(data);
		root.appendChild(answerPage);
		pagesState.pages.push(answerPage);

		// set page numbers for all pages
		setPageNumbers(root);

		// apply Turkish-aware casing transforms for elements that use CSS text-transform
		applyLocaleTransforms(root);

		// After layout is complete, scale pages to fit viewport on small screens
		if (typeof scalePagesToFit === 'function') {
			scalePagesToFit();
		}
	}

  // expose API
  window.PDFPreview = { render };

	// PDF export: capture all .page nodes and assemble an A4 PDF using html2canvas + jsPDF
	async function exportPagesToPdf(filename = 'document.pdf') {
		try {
					// detect html2canvas
					if (typeof window.html2canvas !== 'function') {
						console.warn('html2canvas bulunamadı. Sayfayı PDF olarak oluşturmak için html2canvas yüklü olmalıdır.');
						alert('PDF kütüphanesi "html2canvas" yüklenmedi. Lütfen script bağlantılarını kontrol edin.');
						return;
					}

					// detect jspdf (UMD bundles expose differently across versions)
					let jsPDF = null;
					if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
						jsPDF = window.jspdf.jsPDF;
					} else if (window.jspdf && window.jspdf.default && typeof window.jspdf.default.jsPDF === 'function') {
						jsPDF = window.jspdf.default.jsPDF;
					} else if (typeof window.jsPDF === 'function') {
						jsPDF = window.jsPDF; // some bundles expose directly
					}

					if (!jsPDF) {
						console.warn('jsPDF bulunamadı. window.jspdf veya window.jsPDF bekleniyordu. window keys:', Object.keys(window).filter(k => /pdf/i.test(k)).slice(0,20));
						alert('PDF kütüphanesi "jsPDF" yüklenmedi veya farklı bir export şekli kullanıyor. Lütfen script bağlantılarını kontrol edin.');
						return;
					}

			const pages = Array.from(document.querySelectorAll('.page'));
			if (!pages.length) {
				alert('PDF için sayfa bulunamadı.');
				return;
			}

			// A4 in points for jsPDF (mm -> pt conversion is handled by jsPDF with unit: 'mm')
			const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

			// We'll capture each .page at its natural CSS size (210mm x 297mm). To get good quality,
			// render at devicePixelRatio * scaleFactor. Use scaleFactor = 2 for crisper images.
			const scaleFactor = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));

			for (let i = 0; i < pages.length; i++) {
				const page = pages[i];

				// Clone the page to avoid altering the live document (scale wrappers, transforms exist)
				const clone = page.cloneNode(true);
				// Put the clone off-screen but visible so styles apply
				clone.style.position = 'fixed';
				clone.style.left = '-10000px';
				clone.style.top = '0';
				clone.style.margin = '0';
				clone.style.transform = 'none';
				clone.style.width = page.style.width || getComputedStyle(page).width;
				clone.style.height = page.style.height || getComputedStyle(page).height;
				document.body.appendChild(clone);

						// Before rendering: copy over any canvas content (cloneNode doesn't copy pixels)
						try {
							const origCanvases = page.querySelectorAll('canvas');
							const cloneCanvases = clone.querySelectorAll('canvas');
							for (let ci = 0; ci < origCanvases.length; ci++) {
								const oCan = origCanvases[ci];
								const cCan = cloneCanvases[ci];
								if (!oCan || !cCan) continue;
								try {
									const dataUrl = oCan.toDataURL();
									// draw into cloned canvas
									const img = new Image();
									img.src = dataUrl;
									// synchronous draw when loaded
									await new Promise((res) => {
										img.onload = () => {
											try {
												cCan.width = img.width;
												cCan.height = img.height;
												const ctx = cCan.getContext('2d');
												if (ctx) ctx.drawImage(img, 0, 0);
											} catch (e) { console.warn('drawing cloned canvas failed', e); }
											res();
										};
										img.onerror = () => res();
									});
								} catch (e) {
									console.warn('copy canvas content failed', e);
								}
							}
						} catch (e) {
							console.warn('error copying canvases to clone', e);
						}

						// Ensure cloned <img> tags can be loaded by html2canvas: inline SVGs and set crossorigin when possible
						try {
							const origImgs = page.querySelectorAll('img');
							const cloneImgs = clone.querySelectorAll('img');
							const imgPromises = [];
							for (let ii = 0; ii < cloneImgs.length; ii++) {
								const cImg = cloneImgs[ii];
								const oImg = origImgs[ii];
								if (!cImg) continue;
								const src = cImg.getAttribute('src') || '';
								// If SVG, try to fetch and inline as data URL (safer for cross-origin issues)
								if (src && src.trim().toLowerCase().endsWith('.svg')) {
									try {
										// Try fetching the SVG text from same-origin
										const absolute = new URL(src, window.location.href).href;
										const p = fetch(absolute)
											.then(r => r.ok ? r.text() : Promise.reject(r.status))
											.then(text => {
												const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
												cImg.setAttribute('src', dataUrl);
											})
											.catch(() => {
												// If fetch fails, fall back to leaving src as-is but set crossorigin to anonymous
												try { cImg.setAttribute('crossorigin', 'anonymous'); } catch (e) {}
											});
										imgPromises.push(p);
									} catch (e) {
										try { cImg.setAttribute('crossorigin', 'anonymous'); } catch (er) {}
									}
								} else {
									// non-SVG images: set crossorigin attribute if the origin matches so html2canvas can load them
									try {
										const abs = new URL(src, window.location.href);
										if (abs.origin === window.location.origin) {
											cImg.setAttribute('crossorigin', 'anonymous');
										}
									} catch (e) {
										// ignore
									}
								}

								// Wait until the clone image is loaded (or errored) so html2canvas has image data
								imgPromises.push(new Promise((res) => {
									if (cImg.complete && cImg.naturalHeight !== 0) return res();
									cImg.addEventListener('load', () => res(), { once: true });
									cImg.addEventListener('error', () => res(), { once: true });
									// fallback timeout
									setTimeout(res, 2000);
								}));
							}
							// await all image fetches/copies
							await Promise.all(imgPromises);
						} catch (e) {
							console.warn('error preparing images on clone', e);
						}

						// Use html2canvas to render the clone. Provide scale to boost resolution.
						const canvas = await window.html2canvas(clone, {
					scale: scaleFactor * 2, // extra upscale for crisp text/images
					useCORS: true,
					allowTaint: false,
					backgroundColor: '#ffffff',
					imageTimeout: 3000,
					logging: false,
				});

				// Remove clone immediately after rendering
				clone.remove();

				const imgData = canvas.toDataURL('image/jpeg', 0.98);

				// jsPDF expects dimensions in mm when unit:'mm'
				const pdfWidth = 210; // mm
				const pdfHeight = 297; // mm

				if (i > 0) pdf.addPage();
				pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
			}

			pdf.save(filename);
		} catch (err) {
			console.error('exportPagesToPdf error', err);
			alert('PDF oluşturulurken hata oluştu. Konsolu kontrol edin.');
		}
	}

	// Wire up download button when DOM ready
	document.addEventListener('DOMContentLoaded', () => {
		// Ensure export overlay exists; create dynamically if missing so HTML can remain clean
		try {
			if (!document.getElementById('export-overlay') && typeof window.createExportOverlayElements === 'function') {
				window.createExportOverlayElements();
			}
		} catch (e) { /* ignore */ }
		const btn = document.getElementById('download-pdf-btn');
		if (!btn) return;
		// overlay helpers
		const overlay = document.getElementById('export-overlay');
		function showExportOverlay() {
			if (!overlay) return;
			overlay.setAttribute('aria-hidden', 'false');
			overlay.classList.add('visible');
		}
		function hideExportOverlay() {
			if (!overlay) return;
			overlay.setAttribute('aria-hidden', 'true');
			overlay.classList.remove('visible');
		}

		btn.addEventListener('click', async (e) => {
			// update UI immediately so user knows something started
			btn.setAttribute('disabled', 'true');
			btn.classList.add('btn-primary');
			try {
				showExportOverlay();
				// Small delay helps ensure overlay is painted before heavy work begins
				await new Promise(r => setTimeout(r, 50));
				await exportPagesToPdf('hedef-temelli-destek.pdf');
			} finally {
				hideExportOverlay();
				btn.removeAttribute('disabled');
				btn.classList.remove('btn-primary');
			}
		});
	});

	// Scale pages so their A4 proportions remain intact but fit into narrow viewports.
	// This function calculates the available width (accounting for some gutters and the
	// fixed toolbar) and applies a CSS transform to each .page element.
	function scalePagesToFit() {
		try {
			const pages = Array.from(document.querySelectorAll('.page'));
			if (!pages.length) return;
			// Determine available width from the pdf root container so we respect its padding
			const root = document.getElementById('pdf-root') || document.body;
			const rootStyles = window.getComputedStyle(root);
			const rootPaddingLeft = parseFloat(rootStyles.paddingLeft || 0);
			const rootPaddingRight = parseFloat(rootStyles.paddingRight || 0);
			const rootWidth = root.clientWidth - rootPaddingLeft - rootPaddingRight;

			// Only apply scaling/wrapping on small screens. On larger screens reset any transforms/wrappers.
			if (rootWidth > 900) {
				// unwrap pages if they are wrapped and reset transforms
				pages.forEach(p => {
					const parent = p.parentElement;
					if (parent && parent.classList.contains('page-wrap')) {
						// move page out of wrapper and remove wrapper
						parent.parentNode.insertBefore(p, parent);
						parent.remove();
					}
					p.style.transform = '';
					p.style.margin = '';
				});
				return;
			}

			const available = Math.max(1, rootWidth - 8); // small safety gutter

			pages.forEach(p => {
				// ensure pages are wrapped in a layout container that we can size to match the
				// visual (scaled) height. This lets document flow follow the scaled size.
				let wrapper = p.parentElement;
				if (!wrapper || !wrapper.classList.contains('page-wrap')) {
					wrapper = document.createElement('div');
					wrapper.className = 'page-wrap';
					// insert wrapper before page and move page inside it
					p.parentNode.insertBefore(wrapper, p);
					wrapper.appendChild(p);
				}

				// Capture computed margins first, then clear the page margin and measure size
				const cs = window.getComputedStyle(p);
				const marginTop = parseFloat(cs.marginTop || 0);
				const marginBottom = parseFloat(cs.marginBottom || 0);
				// Temporarily clear transform to measure natural (unscaled) size
				p.style.transform = 'none';
				p.style.margin = '0'; // we'll manage spacing on the wrapper
				const naturalW = Math.max(1, p.getBoundingClientRect().width);
				const naturalH = Math.max(1, p.getBoundingClientRect().height);

				// compute scale to fit within available width while preserving proportions
				let scale = 1;
				if (naturalW > available) {
					scale = available / naturalW;
				}
				// clamp a reasonable minimum so text isn't too small
				scale = Math.max(scale, 0.45);

				// Apply visual scale to the page element
				p.style.transformOrigin = 'top left';
				p.style.transform = `scale(${scale}) translateZ(0)`;

				// Size the wrapper so the document flow height equals the scaled visual height
				wrapper.style.width = (naturalW * scale) + 'px';
				wrapper.style.height = (naturalH * scale) + 'px';
				wrapper.style.overflow = 'visible';
				wrapper.style.boxSizing = 'content-box';
				wrapper.style.marginTop = (marginTop * scale) + 'px';
				wrapper.style.marginBottom = (marginBottom * scale) + 'px';
				// ensure page itself doesn't contribute extra margins in flow
				p.style.margin = '0';
			});
		} catch (e) {
			// fail silently
			console.error('scalePagesToFit error', e);
		}
	}

	// Re-scale on orientation / resize
	let _scaleTimer = null;
	window.addEventListener('resize', () => {
		if (_scaleTimer) clearTimeout(_scaleTimer);
		_scaleTimer = setTimeout(scalePagesToFit, 120);
	});
	window.addEventListener('orientationchange', () => {
		setTimeout(scalePagesToFit, 140);
	});
})();

// --- Moved model logic from index.html ---
// Fetch demo data and wire up modal after initial render


// Modal wiring: open, populate, save
function initEditModal() {
	const editBtn = document.getElementById('edit-meta-btn');
	const modal = document.getElementById('edit-modal');
	const closeBtn = document.getElementById('edit-modal-close');
	const cancelBtn = document.getElementById('modal-cancel');
	const saveBtn = document.getElementById('modal-save');

	const inputLesson = document.getElementById('input-lessonName');
	const inputSubject = document.getElementById('input-subjectName');
	const selectTest = document.getElementById('select-testType');

	function openModal() {
		const data = window._pdfData || {};
		if (inputLesson) inputLesson.value = data.lessonName || '';
		if (inputSubject) inputSubject.value = data.subjectName || '';

		// populate select with availableTestTypes and an empty option
		if (selectTest) {
			selectTest.innerHTML = '';
			const emptyOpt = document.createElement('option');
			emptyOpt.value = '';
			emptyOpt.textContent = '(Boş bırak)';
			selectTest.appendChild(emptyOpt);
			const arr = Array.isArray(data.availableTestTypes) ? data.availableTestTypes : [];
			arr.forEach(t => {
				const o = document.createElement('option');
				o.value = t;
				o.textContent = String(t).toUpperCase();
				selectTest.appendChild(o);
			});
			selectTest.value = data.testType || '';
		}

		if (modal) {
			modal.setAttribute('aria-hidden', 'false');
			modal.classList.add('open');
			document.body.classList.add('modal-open');
		}
		// focus first editable input (skip school which is read-only)
		if (inputLesson) inputLesson.focus();
	}

	function closeModal() {
		if (!modal) return;
		modal.setAttribute('aria-hidden', 'true');
		modal.classList.remove('open');
		document.body.classList.remove('modal-open');
	}

	function save() {
		window._pdfData = window._pdfData || {};
		// School name is not editable via the modal; keep original value from data (do not reference missing inputSchool)
		// window._pdfData.schoolName remains unchanged unless provided elsewhere
		if (inputLesson) window._pdfData.lessonName = inputLesson.value.trim();
		if (inputSubject) window._pdfData.subjectName = inputSubject.value.trim();
		if (selectTest) window._pdfData.testType = selectTest.value || '';
		// re-render with updated data
		if (window.PDFPreview && typeof window.PDFPreview.render === 'function') {
			window.PDFPreview.render(window._pdfData);
		}
		closeModal();
	}

	if (editBtn) editBtn.addEventListener('click', openModal);
	if (closeBtn) closeBtn.addEventListener('click', closeModal);
	if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
	if (saveBtn) saveBtn.addEventListener('click', save);

	// close when clicking outside modal
	if (modal) modal.addEventListener('click', (e) => {
		if (e.target === modal) closeModal();
	});
	// close on ESC
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
	});
}

// --- End moved model logic ---

// Creates modal DOM elements and inserts them into the document.
// Call this from HTML before calling initEditModal() if you prefer to control initialization from HTML.
function createModalElements() {
	if (document.getElementById('edit-modal')) return; // already inserted

	// container overlay
	const modalOverlay = document.createElement('div');
	modalOverlay.id = 'edit-modal';
	modalOverlay.className = 'modal-overlay';
	modalOverlay.setAttribute('aria-hidden', 'true');

	const modal = document.createElement('div');
	modal.className = 'modal';
	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');
	modal.setAttribute('aria-labelledby', 'edit-modal-title');

	// header
	const header = document.createElement('header');
	header.className = 'modal-header';
	const h3 = document.createElement('h3');
	h3.id = 'edit-modal-title';
	h3.textContent = 'Sayfa Bilgilerini Düzenle';
	const closeBtn = document.createElement('button');
	closeBtn.className = 'modal-close';
	closeBtn.id = 'edit-modal-close';
	closeBtn.type = 'button';
	closeBtn.setAttribute('aria-label', 'Kapat');
	closeBtn.innerHTML = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
			<path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" fill="currentColor"/>
		</svg>`;
	header.appendChild(h3);
	header.appendChild(closeBtn);

	// body
	const body = document.createElement('div');
	body.className = 'modal-body';

	// Ders Adı
	const labelLesson = document.createElement('label');
	labelLesson.textContent = '\n                    Ders Adı\n                    ';
	const inputLesson = document.createElement('input');
	inputLesson.id = 'input-lessonName';
	inputLesson.type = 'text';
	inputLesson.placeholder = 'Ders adı';
	labelLesson.appendChild(document.createTextNode('\n                    '));
	labelLesson.appendChild(inputLesson);

	// Konu
	const labelSubject = document.createElement('label');
	labelSubject.textContent = '\n                    Konu\n                    ';
	const inputSubject = document.createElement('input');
	inputSubject.id = 'input-subjectName';
	inputSubject.type = 'text';
	inputSubject.placeholder = 'Konu';
	labelSubject.appendChild(document.createTextNode('\n                    '));
	labelSubject.appendChild(inputSubject);

	// Test Türü select
	const labelTest = document.createElement('label');
	labelTest.textContent = '\n                    Test Türü\n                    ';
	const selectTest = document.createElement('select');
	selectTest.id = 'select-testType';
	selectTest.innerHTML = '<!-- options populated dynamically -->';
	labelTest.appendChild(document.createTextNode('\n                    '));
	labelTest.appendChild(selectTest);

	body.appendChild(labelLesson);
	body.appendChild(labelSubject);
	body.appendChild(labelTest);

	// footer
	const footer = document.createElement('footer');
	footer.className = 'modal-footer';
	const cancelBtn = document.createElement('button');
	cancelBtn.id = 'modal-cancel';
	cancelBtn.className = 'btn';
	cancelBtn.type = 'button';
	cancelBtn.textContent = 'İptal';
	const saveBtn = document.createElement('button');
	saveBtn.id = 'modal-save';
	saveBtn.className = 'btn btn-primary';
	saveBtn.type = 'button';
	saveBtn.textContent = 'Kaydet';
	footer.appendChild(cancelBtn);
	footer.appendChild(saveBtn);

	modal.appendChild(header);
	modal.appendChild(body);
	modal.appendChild(footer);
	modalOverlay.appendChild(modal);

	// insert before pdf-root if available, otherwise append to body
	const pdfRoot = document.getElementById('pdf-root');
	if (pdfRoot && pdfRoot.parentNode) {
		pdfRoot.parentNode.insertBefore(modalOverlay, pdfRoot);
	} else {
		document.body.appendChild(modalOverlay);
	}

	// expose created elements for convenience (non-enumerable)
	try {
		Object.defineProperty(window, '__createdEditModal', { value: true, configurable: true });
	} catch (e) { /* ignore */ }
}

// expose factory for callers in HTML
window.createModalElements = createModalElements;

// Creates export overlay elements and inserts them into the document.
function createExportOverlayElements() {
	if (document.getElementById('export-overlay')) return;
	const overlay = document.createElement('div');
	overlay.id = 'export-overlay';
	overlay.className = 'export-overlay';
	overlay.setAttribute('aria-hidden', 'true');
	overlay.setAttribute('role', 'status');
	overlay.setAttribute('aria-live', 'polite');

	const inner = document.createElement('div');
	inner.className = 'export-overlay-inner';
	const spinner = document.createElement('div');
	spinner.className = 'spinner';
	spinner.setAttribute('aria-hidden', 'true');
	const msg = document.createElement('div');
	msg.className = 'export-message';
	msg.textContent = 'PDF hazırlanıyor, lütfen bekleyin...';
	inner.appendChild(spinner);
	inner.appendChild(msg);
	overlay.appendChild(inner);

	// Insert at end of body
	document.body.appendChild(overlay);
}

window.createExportOverlayElements = createExportOverlayElements;

// Creates the top toolbar (title, edit and download buttons) and inserts into the document.
function createToolbarElements() {
	if (document.querySelector('.top-toolbar')) return;
	const toolbar = document.createElement('div');
	toolbar.className = 'top-toolbar';
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', 'Page toolbar');

	const inner = document.createElement('div');
	inner.className = 'toolbar-inner';
	const title = document.createElement('div');
	title.className = 'toolbar-title';
	title.textContent = 'PDF Oluştur';
	const actions = document.createElement('div');
	actions.className = 'toolbar-actions';

	const editBtn = document.createElement('button');
	editBtn.id = 'edit-meta-btn';
	editBtn.className = 'btn btn-primary';
	editBtn.type = 'button';
	editBtn.textContent = 'Düzenle';

	const downloadBtn = document.createElement('button');
	downloadBtn.id = 'download-pdf-btn';
	downloadBtn.className = 'btn';
	downloadBtn.type = 'button';
	downloadBtn.title = 'PDF indir';
	downloadBtn.innerHTML = `
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
			<path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M21 21H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		<span class="sr-only">PDF İndir</span>`;

	actions.appendChild(editBtn);
	actions.appendChild(downloadBtn);
	inner.appendChild(title);
	inner.appendChild(actions);
	toolbar.appendChild(inner);

	// insert at top of body
	document.body.insertBefore(toolbar, document.body.firstChild);

	// ensure overlay exists
	if (!document.getElementById('export-overlay') && typeof window.createExportOverlayElements === 'function') {
		window.createExportOverlayElements();
	}

	// If download button wiring already exists in DOMContentLoaded listener, it will pick up this button.
}

window.createToolbarElements = createToolbarElements;