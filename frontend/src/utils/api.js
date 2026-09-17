import axios from "axios";

const envBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL =
  envBase && !envBase.includes(":5000") && !envBase.includes("localhost")
    ? envBase
    : "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("echobreak_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
