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
				<img src="images/mebi.svg" alt="MEBİ Logo" class="mebi_logo">
				<img src="images/stripes.png" class="stripes">
				<img src="images/ribbon.png" class="ribbon">
				<div class="test-type">${escapeHtml(data.testType || '')}</div>
				<span class="first-page-title">HEDEF TEMELLİ DESTEK EĞİTİMİ</span>
				<span class="first-page-subtitle">${escapeHtml(data.schoolName || 'okul adı')}</span>
				<div class="first-page-bar">
					<span class="lesson-name">${escapeHtml(data.lessonName || 'ders adı')}</span>
					<span class="subject-name">${escapeHtml(data.subjectName || 'konu adı')}</span>
					<div class="qr-code"><img src="${escapeHtml(data.qrCodeUrl || '')}"></div>
				</div>
			</div>
			<div class="content">
				<div class="left-column"></div>
				<div class="divider"></div>
				<div class="right-column"></div>
			</div>
			<div class="footer">
				<div class="ogm-title">ORTAÖĞRETİM GENEL MÜDÜRLÜĞÜ</div>
				<div class="page-number"></div>
				<img src="images/ribbon.png" class="ribbon">
				<img src="images/stripes.png" class="stripes">
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
				<img src="images/mebi.svg" alt="MEBİ Logo" class="mebi_logo">
				<img src="images/stripes.png" class="stripes">
				<div class="page-bar">
					<span class="subject-name">${escapeHtml(data.subjectName || 'konu adı')}</span>
				</div>
			</div>
			<div class="content">
				<div class="left-column"></div>
				<div class="divider"></div>
				<div class="right-column"></div>
			</div>
			<div class="footer">
				<div class="ogm-title">ORTAÖĞRETİM GENEL MÜDÜRLÜĞÜ</div>
				<div class="page-number"></div>
				<img src="images/ribbon.png" class="ribbon">
				<img src="images/stripes.png" class="stripes">
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

		// After layout is complete, scale pages to fit viewport on small screens
		if (typeof scalePagesToFit === 'function') {
			scalePagesToFit();
		}
	}

  // expose API
  window.PDFPreview = { render };

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