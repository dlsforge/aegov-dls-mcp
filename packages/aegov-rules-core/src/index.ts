/**
 * @dlsforge/aegov-rules-core — machine-readable model of the UAE Design
 * System (AEGOV DLS): schema, catalogue loader, and the DLS rule engine.
 *
 * Community project. Not affiliated with or endorsed by TDRA.
 */
export * from "./catalog/types.js";
export { loadCatalog, loadUaePass } from "./catalog/load.js";
export {
  type Finding,
  type ClassBuckets,
  type ClassIndex,
  EID_PATTERN,
  classTokens,
  buildClassIndex,
  checkClassIdentity,
  checkImgAlt,
  checkButtonType,
  checkFullEidValue,
  checkEmiratesIdInputs,
  checkMdyDates,
  checkArabicRtl,
  validateHtml,
} from "./rules/engine.js";
