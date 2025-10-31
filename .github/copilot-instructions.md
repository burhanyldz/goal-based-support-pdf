<todos title="Fix WYSIWYG Bold Activation" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] investigate-wysiwyg-bold-issue: Inspect current WYSIWYG initialization and browser behavior causing bold command to activate on hover/click 🔴
  _Sticky formatting comes from execCommand state persisting after toolbar use; caret inherits bold when collapsed in plain text._
- [x] implement-reset-selection-handling: Adjust editor event handling to prevent bold state activation when hovering or clicking without selection 🔴
  _Reworked toolbar handlers to limit inline commands to selections, toggle state off after use, and reset sticky formatting when caret moves._
- [x] verify-editor-behavior: Test modal editors to confirm bold state stays inactive until explicitly toggled 🟡
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
