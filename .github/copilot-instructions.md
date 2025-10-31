<todos title="Make deneme match single-test mobile behavior" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] 1-plan-compare-styles: Compare `goal-based/single-test/style.scss` mobile/responsive rules and toolbar/button styles vs `goal-based/deneme/style.scss` to identify differences. 🔴
  _Read both style.scss files and located the mobile block and page-scaling rules in single-test._
- [x] 2-apply-mobile-styles: Update `goal-based/deneme/style.scss` to include mobile styles, page scaling related CSS, and ensure `.mobile-btn` displays on small screens. 🔴
  _Replaced deneme responsive block with single-test mobile block and added #pdf-root and page-wrap rules._
- [x] 3-add-scaling-js: Add `_scalePagesToFit` implementation to `goal-based/deneme/script.js` so pages scale to fit narrow viewports like single-test. 🔴
  _Copied scale function from single-test and adapted to use DenemePDF config and container._
- [x] 4-add-resize-listeners: Add resize and orientationchange listeners in `goal-based/deneme/script.js` to call `_scalePagesToFit` on viewport changes. 🔴
  _Appended debounced resize and orientationchange handlers to `_setupEventListeners`._
- [x] 5-verify-quick-check: Quick file-check ensuring mobile icon button exists and CSS shows `.mobile-btn` on small screens; ensure there are no obvious syntax issues introduced. 🟡
  _Confirmed mobile homework icon button already existed in deneme toolbar; CSS updated to enable it and scale behavior added._
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
