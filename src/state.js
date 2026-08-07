// Shared mutable application state.
//
// index.html originally kept these as top-level `let` bindings inside one
// classic <script>, so every function on the page saw the same variables.
// ES modules have no shared global scope, but ES module *live bindings* give
// the same semantics: importers always read the current value. Only writes
// have to go through the setters below.
export let CONDOS = [];
export let COMMERCIALS = [];
export let SCHOOLS = [];
export let SCHOOLS_DETAIL = {};

export let filtered = [];
export let markers = {};
export let selectedCondo = null;
export let currentSort = 'name';

export let showCommercial = true;
export let showSchools = true;
export let showAwardOnly = false;
export let legendOpen = false;

export let sfActive = false;
export let sfSelectedSchool = null;

export function setCondos(v) { CONDOS = v; }
export function setCommercials(v) { COMMERCIALS = v; }
export function setSchools(v) { SCHOOLS = v; }
export function setSchoolsDetail(v) { SCHOOLS_DETAIL = v; }
export function setFiltered(v) { filtered = v; }
export function setMarkers(v) { markers = v; }
export function setSelectedCondo(v) { selectedCondo = v; }
export function setCurrentSort(v) { currentSort = v; }
export function setShowCommercial(v) { showCommercial = v; }
export function setShowSchools(v) { showSchools = v; }
export function setShowAwardOnly(v) { showAwardOnly = v; }
export function setLegendOpen(v) { legendOpen = v; }
export function setSfActive(v) { sfActive = v; }
export function setSfSelectedSchool(v) { sfSelectedSchool = v; }
