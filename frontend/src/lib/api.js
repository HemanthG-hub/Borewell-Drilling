import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fetchWells = () => api.get("/wells").then(r => r.data);
export const fetchWell = (id) => api.get(`/wells/${id}`).then(r => r.data);
export const fetchCases = (params) => api.get("/cases", { params }).then(r => r.data);
export const fetchCase = (id) => api.get(`/cases/${id}`).then(r => r.data);
export const fetchSensorTrace = (id) => api.get(`/cases/${id}/sensor-trace`).then(r => r.data);
export const fetchCaseEvidence = (id) => api.get(`/cases/${id}/evidence`).then(r => r.data);
export const fetchEvidence = (id) => api.get(`/evidence/${id}`).then(r => r.data);
export const fetchConflicts = () => api.get("/conflicts").then(r => r.data);
export const fetchKPIs = () => api.get("/kpis").then(r => r.data);
export const fetchLiveEvent = () => api.get("/live-event").then(r => r.data);
export const runRecall = (event) => api.post("/recall", event).then(r => r.data);
export const fetchExperienceDna = (id) => api.get(`/experience-dna/${id}`).then(r => r.data);
export const fetchMemoryQuality = () => api.get("/memory-quality").then(r => r.data);
export const fetchAlertSituations = () => api.get("/alerts/situations").then(r => r.data);
