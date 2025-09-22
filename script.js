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
		const wrapper = createEl('div', 'question');
		const num = createEl('div', 'question-number');
		num.textContent = q.questionNumber != null ? q.questionNumber + '.' : '';
		const img = createEl('img', 'question-image', { src: q.imageUrl || '' });
		// ensure aspect ratio preserved
		img.style.width = '100%';
		img.style.height = 'auto';
		wrapper.appendChild(num);
		wrapper.appendChild(img);
		return { wrapper, img };
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
			const questionEl = createQuestionElement(q);
			placeInColumn(pageEl, colSelector, questionEl);

			// wait for image to load so measurements are correct
			await ensureImageLoaded(questionEl.img);

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
				placeInColumn(pageEl, '.right-column', rightQuestion);
				await ensureImageLoaded(rightQuestion.img);
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
	}

  // expose API
  window.PDFPreview = { render };
})();