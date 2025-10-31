<todos title="Implement Edit Dialog for Deneme" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] 1-review-requirements: Review requirements and plan implementation - Fields: denemeName, attentionCandidate, attention, denemeInstructions. Labels: 'Deneme Başlığı', 'Adayın Dikkatine metni', 'Dikkat metni', 'Açıklama Metni'. WYSIWYG for attention & denemeInstructions without font size/family controls. 🔴
- [x] 2-add-modal-html-structure: Add modal HTML structure to script.js - Create _createModal() function with 4 fields (1 text input for denemeName, 1 textarea for attentionCandidate, 2 WYSIWYG fields for attention & denemeInstructions). Use same modal structure as single-test. 🔴
- [x] 3-add-wysiwyg-toolbar: Implement WYSIWYG toolbar functionality - Add toolbar with bold, italic, underline, strikethrough, ordered/unordered lists, undo/redo. NO font size or font family. Use contenteditable divs. 🔴
- [x] 4-add-modal-init-logic: Add modal initialization and event handlers - Create _initModal() with open/close/save logic. Populate from examData, handle WYSIWYG content, save changes, trigger re-render. 🔴
- [x] 5-add-edit-button-toolbar: Add Edit button to toolbar - Add desktop Edit button and mobile Edit button (in context menu). Hook up to openEdit() method. 🔴
- [x] 6-copy-modal-styles: Copy and adapt modal styles from single-test - Copy modal styles from single-test/style.scss to deneme/style.scss. Add WYSIWYG-specific styles and textarea styles. 🔴
- [x] 7-add-public-api: Add public openEdit() method - Add openEdit() public method to DenemePDF object for programmatic modal opening. 🟡
- [x] 8-test-functionality: Test edit dialog functionality - Test opening modal, editing all fields with WYSIWYG, saving, verifying data updates. Test desktop and mobile views. 🟡
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
